import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { lastValueFrom } from 'rxjs';

import { DriveSyncService } from './drive-sync.service';
import { GoogleAuthService, GoogleAuthError } from './google-auth.service';
import { TransactionService } from './transaction.service';
import { CategoryService } from './category.service';

const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

describe('DriveSyncService', () => {
  let service: DriveSyncService;
  let httpMock: HttpTestingController;
  let transactionService: TransactionService;
  let categoryService: CategoryService;
  let auth: { getAccessToken: jasmine.Spy; invalidateToken: jasmine.Spy };

  beforeEach(() => {
    localStorage.clear();
    auth = {
      getAccessToken: jasmine.createSpy('getAccessToken').and.resolveTo('fake-token'),
      invalidateToken: jasmine.createSpy('invalidateToken').and.resolveTo(undefined)
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GoogleAuthService, useValue: auth }
      ]
    });

    service = TestBed.inject(DriveSyncService);
    httpMock = TestBed.inject(HttpTestingController);
    transactionService = TestBed.inject(TransactionService);
    categoryService = TestBed.inject(CategoryService);
  });

  afterEach(() => {
    localStorage.clear();
    httpMock.verify();
  });

  /** No zone.js in this zoneless app means no fakeAsync/tick — poll with real macrotask yields until the service's chained awaits reach the next pending HTTP call. */
  async function expectAndFlush(
    matcher: (req: import('@angular/common/http').HttpRequest<unknown>) => boolean,
    body: unknown,
    opts?: { status: number; statusText: string }
  ): Promise<TestRequest> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const matches = httpMock.match(matcher);
      if (matches.length > 0) {
        matches[0].flush(body as never, opts);
        return matches[0];
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error('No matching HTTP request appeared in time');
  }

  const isFolderList = (req: import('@angular/common/http').HttpRequest<unknown>) =>
    req.url === FILES_URL && req.method === 'GET' && !!req.params.get('q')?.includes('folder');
  const isFileList = (req: import('@angular/common/http').HttpRequest<unknown>) =>
    req.url === FILES_URL && req.method === 'GET' && !!req.params.get('q')?.includes('moneta-sync.json');
  const isDownload = (req: import('@angular/common/http').HttpRequest<unknown>) =>
    req.url === `${FILES_URL}/file-1` && req.method === 'GET';
  const isCreateFolder = (req: import('@angular/common/http').HttpRequest<unknown>) =>
    req.url === `${FILES_URL}?fields=id` && req.method === 'POST';
  const isPatchUpload = (req: import('@angular/common/http').HttpRequest<unknown>) =>
    req.url === `${UPLOAD_URL}/file-1?uploadType=media` && req.method === 'PATCH';

  async function flushNoExistingSyncFile(): Promise<void> {
    await expectAndFlush(isFolderList, { files: [] });
    await expectAndFlush(isCreateFolder, { id: 'folder-1' });
    await expectAndFlush(isFileList, { files: [] });
  }

  async function flushExistingSyncFile(remotePayload: object): Promise<void> {
    await expectAndFlush(isFolderList, { files: [{ id: 'folder-1' }] });
    await expectAndFlush(isFileList, { files: [{ id: 'file-1' }] });
    await expectAndFlush(isDownload, remotePayload);
  }

  it('pull() with no remote file keeps local data and reports zero added/updated', async () => {
    await lastValueFrom(
      transactionService.create({
        categoryId: 'cat-1',
        type: 'expense',
        name: 'Supermercado',
        description: '',
        amount: 1000,
        date: new Date(2026, 0, 1)
      })
    );

    const resultPromise = service.pull();
    await flushNoExistingSyncFile();
    const result = await resultPromise;

    expect(result.transactions).toEqual({ added: 0, updated: 0 });
    expect(transactionService.getAllIncludingDeleted().length).toBe(1);
  });

  it('pull() defaults missing keys in an old remote payload to empty arrays instead of crashing', async () => {
    // Regression test: a sync file written before budgets/accounts/goals existed lacks those keys entirely.
    const legacyRemotePayload = {
      transactions: [],
      categories: []
      // bills/budgets/accounts/transfers/goals/goalContributions/transactionCalculations intentionally absent
    };

    const resultPromise = service.pull();
    await flushExistingSyncFile(legacyRemotePayload);
    const result = await resultPromise;

    expect(result.budgets).toEqual({ added: 0, updated: 0 });
    expect(result.goals).toEqual({ added: 0, updated: 0 });
    expect(result.transactionCalculations).toEqual({ added: 0, updated: 0 });
  });

  it('push() uploads the merged payload and patches the existing file', async () => {
    await lastValueFrom(categoryService.create({ name: 'Comida', type: 'expense', color: '#f00', icon: 'tag' }));

    const resultPromise = service.push();
    await flushExistingSyncFile({
      transactions: [],
      categories: [],
      bills: [],
      budgets: [],
      accounts: [],
      transfers: [],
      goals: [],
      goalContributions: [],
      transactionCalculations: []
    });

    const upload = await expectAndFlush(isPatchUpload, { id: 'file-1' });
    const uploadedBody = JSON.parse(upload.request.body as string);
    // CategoryService seeds 2 default categories ("Salario", "Almacén") on first use, plus the one created above.
    expect(uploadedBody.categories.length).toBe(3);
    expect(uploadedBody.categories.some((cat: { name: string }) => cat.name === 'Comida')).toBeTrue();

    const result = await resultPromise;
    expect(result.categories).toEqual({ added: 0, updated: 0 });
  });

  it('invalidates the token and throws a re-auth GoogleAuthError on a 401', async () => {
    const resultPromise = service.pull().catch((err) => err);

    await expectAndFlush(isFolderList, { message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    const thrown = await resultPromise;

    expect(auth.invalidateToken).toHaveBeenCalled();
    expect(thrown).toBeInstanceOf(GoogleAuthError);
    expect((thrown as GoogleAuthError).requiresReauth).toBeTrue();
  });
});
