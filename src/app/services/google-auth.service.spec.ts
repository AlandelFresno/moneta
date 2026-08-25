import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Preferences } from '@capacitor/preferences';

import { GoogleAuthService, GoogleAuthError } from './google-auth.service';

const TOKEN_KEY = 'google_drive_token';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let httpMock: HttpTestingController;

  /**
   * No zone.js in this zoneless app means no fakeAsync/tick — poll with real macrotask yields until the pending HTTP
   * call appears. `match()` splices matched requests out of Angular's internal pending list as a side effect, so the
   * match-and-flush must happen atomically in one call — never call `match()` just to "peek" and discard the result.
   */
  async function expectAndFlush(
    matcher: (req: HttpRequest<unknown>) => boolean,
    body: unknown,
    opts?: { status: number; statusText: string }
  ): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const matches = httpMock.match(matcher);
      if (matches.length > 0) {
        matches[0].flush(body as never, opts);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error('No matching HTTP request appeared in time');
  }

  beforeEach(async () => {
    await Preferences.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(GoogleAuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(async () => {
    await Preferences.clear();
    httpMock.verify();
  });

  it('getAccessToken() throws a re-auth error when there is no session', async () => {
    await expectAsync(service.getAccessToken()).toBeRejectedWith(jasmine.objectContaining({ requiresReauth: true }));
  });

  it('getAccessToken() returns the stored token when it has not expired', async () => {
    await Preferences.set({
      key: TOKEN_KEY,
      value: JSON.stringify({ accessToken: 'valid-token', expiresAt: Date.now() + 60 * 60 * 1000 })
    });
    await service.init();

    expect(await service.getAccessToken()).toBe('valid-token');
  });

  it('getAccessToken() refreshes an expired token via its stored refresh token', async () => {
    await Preferences.set({
      key: TOKEN_KEY,
      value: JSON.stringify({ accessToken: 'stale-token', expiresAt: Date.now() - 1000, refreshToken: 'refresh-abc' })
    });
    await service.init();

    const tokenPromise = service.getAccessToken();
    await expectAndFlush((req) => req.url === TOKEN_URL, { access_token: 'new-token', expires_in: 3600 });

    expect(await tokenPromise).toBe('new-token');
    expect(service.isSignedIn()).toBeTrue();
  });

  it('getAccessToken() invalidates the session when the refresh request fails', async () => {
    await Preferences.set({
      key: TOKEN_KEY,
      value: JSON.stringify({ accessToken: 'stale-token', expiresAt: Date.now() - 1000, refreshToken: 'refresh-abc' })
    });
    await service.init();

    const tokenPromise = service.getAccessToken().catch((err) => err);
    await expectAndFlush((req) => req.url === TOKEN_URL, { error: 'invalid_grant' }, { status: 400, statusText: 'Bad Request' });

    const thrown = await tokenPromise;
    expect(thrown).toBeInstanceOf(GoogleAuthError);
    expect(service.isSignedIn()).toBeFalse();
  });

  it('invalidateToken() clears the session and removes the stored token', async () => {
    await Preferences.set({
      key: TOKEN_KEY,
      value: JSON.stringify({ accessToken: 'x', expiresAt: Date.now() + 100_000 })
    });
    await service.init();
    expect(service.isSignedIn()).toBeTrue();

    await service.invalidateToken();

    expect(service.isSignedIn()).toBeFalse();
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    expect(value).toBeNull();
  });
});
