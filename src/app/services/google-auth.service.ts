import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, lastValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../environments/environment';

export class GoogleAuthError extends Error {
  constructor(message: string, readonly requiresReauth: boolean) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

/** Posted by the oauth2redirect page (opened in a popup on web) back to the window that opened it. */
export interface OAuthRedirectMessage {
  code?: string;
  error?: string;
}

interface GoogleTokenExchangeResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

interface StoredGoogleToken {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

interface OAuthFlowConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  private readonly TOKEN_KEY = 'google_drive_token';
  private readonly SCOPE = 'https://www.googleapis.com/auth/drive.file';

  private readonly webClientId = environment.googleClientId;
  private readonly webClientSecret = environment.googleWebClientSecret;
  private readonly webRedirectUri = `${window.location.origin}/oauth2redirect`;

  private readonly mobileClientId = environment.googleMobileClientId;
  private readonly mobileClientSecret = environment.googleMobileClientSecret;
  private readonly mobileRedirectUri = `com.googleusercontent.apps.${this.mobileClientId.split('.')[0]}:/oauth2redirect`;

  private readonly signedInSubject = new BehaviorSubject<boolean>(false);
  readonly isSignedIn$: Observable<boolean> = this.signedInSubject.asObservable();

  private token: StoredGoogleToken | null = null;
  private deepLinkListenerRegistered = false;

  private pkceCodeVerifier: string | null = null;
  private pkceResolve: (() => void) | null = null;
  private pkceReject: ((error: Error) => void) | null = null;

  constructor(private readonly http: HttpClient) {}

  async init(): Promise<void> {
    const stored = await this.loadToken();
    if (stored) {
      this.token = stored;
      this.signedInSubject.next(true);
    }

    if (Capacitor.isNativePlatform() && !this.deepLinkListenerRegistered) {
      this.deepLinkListenerRegistered = true;
      App.addListener('appUrlOpen', ({ url }) => {
        if (url.startsWith(this.mobileRedirectUri)) {
          void this.handleNativeRedirect(url);
        }
      });
    }
  }

  isSignedIn(): boolean {
    return this.signedInSubject.value;
  }

  async signIn(forceConsent = false): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      return this.signInNative();
    }
    return this.signInWeb(forceConsent);
  }

  async signOut(): Promise<void> {
    const token = this.token;
    if (!token) return;

    await lastValueFrom(this.http.post(`https://oauth2.googleapis.com/revoke?token=${token.accessToken}`, null)).catch(() => undefined);

    await this.invalidateToken();
  }

  /** Returns a valid access token, transparently refreshing as needed. Throws (requiresReauth) once the refresh token itself is missing or dead. */
  async getAccessToken(): Promise<string> {
    if (!this.token) {
      throw new GoogleAuthError('No hay sesión de Google iniciada.', true);
    }

    const EXPIRY_SAFETY_MARGIN_MS = 60_000;
    if (Date.now() < this.token.expiresAt - EXPIRY_SAFETY_MARGIN_MS) {
      return this.token.accessToken;
    }

    if (this.token.refreshToken) {
      await this.refreshAccessToken(this.token.refreshToken);
      return this.token.accessToken;
    }

    throw new GoogleAuthError('La sesión de Google expiró. Reconectá para seguir sincronizando.', true);
  }

  async invalidateToken(): Promise<void> {
    this.token = null;
    this.signedInSubject.next(false);
    await Preferences.remove({ key: this.TOKEN_KEY });
  }

  /** The OAuth client/secret/redirect this running instance authenticates with — native app vs. browser tab never mix. */
  private currentFlowConfig(): OAuthFlowConfig {
    return Capacitor.isNativePlatform()
      ? { clientId: this.mobileClientId, clientSecret: this.mobileClientSecret, redirectUri: this.mobileRedirectUri }
      : { clientId: this.webClientId, clientSecret: this.webClientSecret, redirectUri: this.webRedirectUri };
  }

  /** `prompt: consent` + `access_type: offline` on every connect so a refresh_token always comes back — that's what lets the app renew access silently afterwards, on both platforms. */
  private buildAuthUrl(codeChallenge: string): string {
    const flow = this.currentFlowConfig();
    const params = new HttpParams({
      fromObject: {
        client_id: flow.clientId,
        redirect_uri: flow.redirectUri,
        response_type: 'code',
        scope: this.SCOPE,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent'
      }
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  // ─── Web: Authorization Code + PKCE via a popup window ─────────────────────

  private async signInWeb(_forceConsent: boolean): Promise<void> {
    this.pkceCodeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(this.pkceCodeVerifier);
    const authUrl = this.buildAuthUrl(codeChallenge);

    return new Promise<void>((resolve, reject) => {
      const popup = window.open(authUrl, 'google-oauth', 'width=480,height=640');
      if (!popup) {
        reject(new GoogleAuthError('El navegador bloqueó la ventana de Google. Habilitá los popups e intentá de nuevo.', false));
        return;
      }

      let settled = false;

      const cleanup = (): void => {
        window.removeEventListener('message', onMessage);
        window.clearInterval(closedCheck);
      };

      const onMessage = (event: MessageEvent<OAuthRedirectMessage>): void => {
        if (event.origin !== window.location.origin || event.source !== popup) return;
        settled = true;
        cleanup();
        popup.close();

        const { code, error } = event.data;
        if (error || !code || !this.pkceCodeVerifier) {
          reject(new GoogleAuthError(error ?? 'No se recibió código de autorización.', false));
          return;
        }

        this.exchangeCodeForToken(code, this.pkceCodeVerifier).then(resolve).catch(reject);
      };

      window.addEventListener('message', onMessage);

      const closedCheck = window.setInterval(() => {
        if (popup.closed && !settled) {
          cleanup();
          reject(new GoogleAuthError('Se cerró la ventana de Google antes de completar el inicio de sesión.', false));
        }
      }, 500);
    });
  }

  // ─── Native: OAuth2 Authorization Code + PKCE via system browser ───────────

  private async signInNative(): Promise<void> {
    this.pkceCodeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(this.pkceCodeVerifier);
    const authUrl = this.buildAuthUrl(codeChallenge);

    return new Promise<void>((resolve, reject) => {
      this.pkceResolve = resolve;
      this.pkceReject = reject;
      void Browser.open({ url: authUrl });
    });
  }

  private async handleNativeRedirect(url: string): Promise<void> {
    const queryString = url.includes('?') ? url.split('?')[1] : '';
    const params = new URLSearchParams(queryString);
    const code = params.get('code');
    const error = params.get('error');

    await Browser.close().catch(() => undefined);

    try {
      if (error) {
        throw new GoogleAuthError(`Autenticación rechazada: ${error}`, false);
      }
      if (!code || !this.pkceCodeVerifier) {
        throw new GoogleAuthError('No se recibió código de autorización.', false);
      }
      await this.exchangeCodeForToken(code, this.pkceCodeVerifier);
      this.pkceResolve?.();
    } catch (err) {
      this.pkceReject?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.pkceResolve = null;
      this.pkceReject = null;
      this.pkceCodeVerifier = null;
    }
  }

  private generateCodeVerifier(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return this.base64UrlEncode(bytes);
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  private base64UrlEncode(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  // ─── Token exchange (shared by native + web code exchange, and refresh) ────

  private async exchangeCodeForToken(code: string, codeVerifier: string): Promise<void> {
    const flow = this.currentFlowConfig();
    const body = new HttpParams({
      fromObject: {
        code,
        client_id: flow.clientId,
        client_secret: flow.clientSecret,
        redirect_uri: flow.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
      }
    });

    const response = await this.postTokenRequest(body);
    await this.saveToken({
      accessToken: response.access_token,
      expiresAt: Date.now() + response.expires_in * 1000,
      refreshToken: response.refresh_token
    });
  }

  private async refreshAccessToken(refreshToken: string): Promise<void> {
    const flow = this.currentFlowConfig();
    const body = new HttpParams({
      fromObject: {
        client_id: flow.clientId,
        client_secret: flow.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      }
    });

    try {
      const response = await this.postTokenRequest(body);
      await this.saveToken({
        accessToken: response.access_token,
        expiresAt: Date.now() + response.expires_in * 1000,
        refreshToken
      });
    } catch {
      await this.invalidateToken();
      throw new GoogleAuthError('No se pudo renovar la sesión de Google. Reconectá para seguir sincronizando.', true);
    }
  }

  private async postTokenRequest(body: HttpParams): Promise<GoogleTokenExchangeResponse> {
    try {
      return await lastValueFrom(
        this.http.post<GoogleTokenExchangeResponse>('https://oauth2.googleapis.com/token', body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      );
    } catch (err) {
      throw new Error(this.extractErrorMessage(err));
    }
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { error_description?: string; error?: string } | null;
      return body?.error_description ?? body?.error ?? err.message;
    }
    return 'Error al comunicarse con Google.';
  }

  // ─── Token storage (Capacitor Preferences — falls back to localStorage on web) ─

  private async saveToken(token: StoredGoogleToken): Promise<void> {
    this.token = token;
    await Preferences.set({ key: this.TOKEN_KEY, value: JSON.stringify(token) });
    this.signedInSubject.next(true);
  }

  private async loadToken(): Promise<StoredGoogleToken | null> {
    const { value } = await Preferences.get({ key: this.TOKEN_KEY });
    return value ? (JSON.parse(value) as StoredGoogleToken) : null;
  }
}
