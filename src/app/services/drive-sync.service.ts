import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Preferences } from '@capacitor/preferences';

import { GoogleAuthService, GoogleAuthError } from './google-auth.service';
import { TransactionService, StoredTransaction, toTransaction, fromTransaction } from './transaction.service';
import { CategoryService, StoredCategory, toCategory, fromCategory } from './category.service';
import { BillService, StoredBill, toBill, fromBill } from './bill.service';
import { BudgetService, StoredBudget, toBudget, fromBudget } from './budget.service';
import {
  AccountService,
  StoredAccount,
  toAccount,
  fromAccount,
  StoredAccountTransfer,
  toTransfer,
  fromTransfer
} from './account.service';
import {
  GoalService,
  StoredGoal,
  toGoal,
  fromGoal,
  StoredGoalContribution,
  toGoalContribution,
  fromGoalContribution
} from './goal.service';
import {
  TransactionCalculationService,
  StoredTransactionCalculation,
  toTransactionCalculation,
  fromTransactionCalculation
} from './transaction-calculation.service';
import { Account, AccountTransfer } from '../core/types/account.types';
import { Goal, GoalContribution } from '../core/types/goal.types';
import { TransactionCalculation } from '../core/types/transaction-calculation.types';
import { mergeEntities, purgeOldTombstones } from '../core/utils/sync-merge.util';
import { dedupeCategories } from '../core/utils/category-dedupe.util';

export interface EntitySyncStats {
  added: number;
  updated: number;
}

export interface SyncResult {
  syncedAt: Date;
  transactions: EntitySyncStats;
  categories: EntitySyncStats;
  bills: EntitySyncStats;
  budgets: EntitySyncStats;
  accounts: EntitySyncStats;
  transfers: EntitySyncStats;
  goals: EntitySyncStats;
  goalContributions: EntitySyncStats;
  transactionCalculations: EntitySyncStats;
}

type SyncStats = Omit<SyncResult, 'syncedAt'>;

interface DriveFile {
  id: string;
  name?: string;
}

interface DriveFileListResponse {
  files: DriveFile[];
}

interface DriveSyncPayload {
  transactions: StoredTransaction[];
  categories: StoredCategory[];
  bills: StoredBill[];
  budgets: StoredBudget[];
  accounts: StoredAccount[];
  transfers: StoredAccountTransfer[];
  goals: StoredGoal[];
  goalContributions: StoredGoalContribution[];
  transactionCalculations: StoredTransactionCalculation[];
}

const EMPTY_PAYLOAD: DriveSyncPayload = {
  transactions: [],
  categories: [],
  bills: [],
  budgets: [],
  accounts: [],
  transfers: [],
  goals: [],
  goalContributions: [],
  transactionCalculations: []
};

@Injectable({
  providedIn: 'root'
})
export class DriveSyncService {
  private readonly SYNC_FILE_NAME = 'moneta-sync.json';
  private readonly LAST_SYNCED_KEY = 'google_drive_last_synced_at';
  private readonly FILES_URL = 'https://www.googleapis.com/drive/v3/files';
  private readonly UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

  constructor(
    private readonly http: HttpClient,
    private readonly auth: GoogleAuthService,
    private readonly transactionService: TransactionService,
    private readonly categoryService: CategoryService,
    private readonly billService: BillService,
    private readonly budgetService: BudgetService,
    private readonly accountService: AccountService,
    private readonly goalService: GoalService,
    private readonly transactionCalculationService: TransactionCalculationService
  ) {}

  /** Downloads remote data, merges it into local storage, and writes the merged result locally. Does not upload. */
  async pull(): Promise<SyncResult> {
    const existingFile = await this.findSyncFile();
    const remotePayload = existingFile ? await this.downloadPayload(existingFile.id) : EMPTY_PAYLOAD;

    const { deduped, stats } = this.mergeWithLocal(remotePayload);

    this.transactionService.replaceAll(deduped.transactions);
    this.categoryService.replaceAll(deduped.categories);
    this.billService.replaceAll(deduped.bills);
    this.budgetService.replaceAll(deduped.budgets);
    this.accountService.replaceAll(deduped.accounts);
    this.accountService.replaceAllTransfers(deduped.transfers);
    this.goalService.replaceAll(deduped.goals);
    this.goalService.replaceAllContributions(deduped.goalContributions);
    this.transactionCalculationService.replaceAll(deduped.transactionCalculations);

    return this.finalizeResult(stats);
  }

  /** Merges remote data with local (without persisting it locally), then uploads the merged result to Drive. */
  async push(): Promise<SyncResult> {
    const existingFile = await this.findSyncFile();
    const remotePayload = existingFile ? await this.downloadPayload(existingFile.id) : EMPTY_PAYLOAD;

    const { deduped, stats } = this.mergeWithLocal(remotePayload);

    await this.uploadPayload(existingFile?.id ?? null, this.toOutgoingPayload(deduped));

    return this.finalizeResult(stats);
  }

  /** Serializes the current local data (deduped, same shape as a Drive backup) for the user to save as a .json file. */
  async exportToJson(): Promise<string> {
    const { deduped } = this.mergeWithLocal(EMPTY_PAYLOAD);
    return JSON.stringify(this.toOutgoingPayload(deduped), null, 2);
  }

  /** Merges a previously exported .json backup into local storage, same semantics as pull() (newest wins, ties go to local). */
  async importFromJson(json: string): Promise<SyncResult> {
    let parsed: Partial<DriveSyncPayload>;
    try {
      parsed = JSON.parse(json) as Partial<DriveSyncPayload>;
    } catch {
      throw new Error('El archivo no es un JSON válido.');
    }

    const importedPayload: DriveSyncPayload = { ...EMPTY_PAYLOAD, ...parsed };
    const { deduped, stats } = this.mergeWithLocal(importedPayload);

    this.transactionService.replaceAll(deduped.transactions);
    this.categoryService.replaceAll(deduped.categories);
    this.billService.replaceAll(deduped.bills);
    this.budgetService.replaceAll(deduped.budgets);
    this.accountService.replaceAll(deduped.accounts);
    this.accountService.replaceAllTransfers(deduped.transfers);
    this.goalService.replaceAll(deduped.goals);
    this.goalService.replaceAllContributions(deduped.goalContributions);
    this.transactionCalculationService.replaceAll(deduped.transactionCalculations);

    return this.buildResult(stats);
  }

  private toOutgoingPayload(deduped: {
    transactions: ReturnType<typeof dedupeCategories>['transactions'];
    categories: ReturnType<typeof dedupeCategories>['categories'];
    bills: ReturnType<typeof dedupeCategories>['bills'];
    budgets: ReturnType<typeof dedupeCategories>['budgets'];
    accounts: Account[];
    transfers: AccountTransfer[];
    goals: Goal[];
    goalContributions: GoalContribution[];
    transactionCalculations: TransactionCalculation[];
  }): DriveSyncPayload {
    return {
      transactions: deduped.transactions.map(fromTransaction),
      categories: deduped.categories.map(fromCategory),
      bills: deduped.bills.map(fromBill),
      budgets: deduped.budgets.map(fromBudget),
      accounts: deduped.accounts.map(fromAccount),
      transfers: deduped.transfers.map(fromTransfer),
      goals: deduped.goals.map(fromGoal),
      goalContributions: deduped.goalContributions.map(fromGoalContribution),
      transactionCalculations: deduped.transactionCalculations.map(fromTransactionCalculation)
    };
  }

  private mergeWithLocal(remotePayload: DriveSyncPayload): {
    deduped: ReturnType<typeof dedupeCategories> & {
      accounts: Account[];
      transfers: AccountTransfer[];
      goals: Goal[];
      goalContributions: GoalContribution[];
      transactionCalculations: TransactionCalculation[];
    };
    stats: SyncStats;
  } {
    const now = new Date();

    const transactionsResult = mergeEntities(
      this.transactionService.getAllIncludingDeleted(),
      remotePayload.transactions.map(toTransaction)
    );
    const mergedTransactions = purgeOldTombstones(transactionsResult.merged, now);

    const categoriesResult = mergeEntities(
      this.categoryService.getAllIncludingDeleted(),
      remotePayload.categories.map(toCategory)
    );
    const mergedCategories = purgeOldTombstones(categoriesResult.merged, now);

    const billsResult = mergeEntities(this.billService.getAllIncludingDeleted(), remotePayload.bills.map(toBill));
    const mergedBills = purgeOldTombstones(billsResult.merged, now);

    const budgetsResult = mergeEntities(this.budgetService.getAllIncludingDeleted(), remotePayload.budgets.map(toBudget));
    const mergedBudgets = purgeOldTombstones(budgetsResult.merged, now);

    const accountsResult = mergeEntities(this.accountService.getAllIncludingDeleted(), remotePayload.accounts.map(toAccount));
    const mergedAccounts = purgeOldTombstones(accountsResult.merged, now);

    const transfersResult = mergeEntities(
      this.accountService.getAllTransfersIncludingDeleted(),
      remotePayload.transfers.map(toTransfer)
    );
    const mergedTransfers = purgeOldTombstones(transfersResult.merged, now);

    const goalsResult = mergeEntities(this.goalService.getAllIncludingDeleted(), remotePayload.goals.map(toGoal));
    const mergedGoals = purgeOldTombstones(goalsResult.merged, now);

    const goalContributionsResult = mergeEntities(
      this.goalService.getAllContributionsIncludingDeleted(),
      remotePayload.goalContributions.map(toGoalContribution)
    );
    const mergedGoalContributions = purgeOldTombstones(goalContributionsResult.merged, now);

    const transactionCalculationsResult = mergeEntities(
      this.transactionCalculationService.getAllIncludingDeleted(),
      remotePayload.transactionCalculations.map(toTransactionCalculation)
    );
    const mergedTransactionCalculations = purgeOldTombstones(transactionCalculationsResult.merged, now);

    const categoryDeduped = dedupeCategories(mergedCategories, mergedTransactions, mergedBills, mergedBudgets, now);

    return {
      deduped: {
        ...categoryDeduped,
        accounts: mergedAccounts,
        transfers: mergedTransfers,
        goals: mergedGoals,
        goalContributions: mergedGoalContributions,
        transactionCalculations: mergedTransactionCalculations
      },
      stats: {
        transactions: { added: transactionsResult.added, updated: transactionsResult.updated },
        categories: { added: categoriesResult.added, updated: categoriesResult.updated },
        bills: { added: billsResult.added, updated: billsResult.updated },
        budgets: { added: budgetsResult.added, updated: budgetsResult.updated },
        accounts: { added: accountsResult.added, updated: accountsResult.updated },
        transfers: { added: transfersResult.added, updated: transfersResult.updated },
        goals: { added: goalsResult.added, updated: goalsResult.updated },
        goalContributions: { added: goalContributionsResult.added, updated: goalContributionsResult.updated },
        transactionCalculations: { added: transactionCalculationsResult.added, updated: transactionCalculationsResult.updated }
      }
    };
  }

  private buildResult(stats: SyncStats): SyncResult {
    return { syncedAt: new Date(), ...stats };
  }

  /** Only pull()/push() persist this — it specifically tracks Google Drive sync recency, not local imports. */
  private async finalizeResult(stats: SyncStats): Promise<SyncResult> {
    const result = this.buildResult(stats);
    await Preferences.set({ key: this.LAST_SYNCED_KEY, value: result.syncedAt.toISOString() });
    return result;
  }

  async getLastSyncedAt(): Promise<Date | null> {
    const { value } = await Preferences.get({ key: this.LAST_SYNCED_KEY });
    return value ? new Date(value) : null;
  }

  /** appDataFolder is a special, hidden Drive space Google guarantees is exactly one folder per (account, app) — no name search, no risk of duplicates. */
  private findSyncFile(): Promise<DriveFile | null> {
    return this.withAuth(async (headers) => {
      const query = new HttpParams({
        fromObject: {
          q: `name='${this.SYNC_FILE_NAME}' and trashed=false`,
          fields: 'files(id,name)',
          spaces: 'appDataFolder'
        }
      });

      const result = await lastValueFrom(
        this.http.get<DriveFileListResponse>(this.FILES_URL, { headers, params: query })
      );
      return result.files[0] ?? null;
    });
  }

  private async downloadPayload(fileId: string): Promise<DriveSyncPayload> {
    const payload = await this.withAuth((headers) =>
      lastValueFrom(
        this.http.get<Partial<DriveSyncPayload>>(`${this.FILES_URL}/${fileId}`, {
          headers,
          params: new HttpParams({ fromObject: { alt: 'media' } })
        })
      )
    );
    return { ...EMPTY_PAYLOAD, ...payload };
  }

  private uploadPayload(existingFileId: string | null, payload: DriveSyncPayload): Promise<string> {
    return this.withAuth(async (headers) => {
      const content = JSON.stringify(payload);

      if (existingFileId) {
        const updated = await lastValueFrom(
          this.http.patch<DriveFile>(`${this.UPLOAD_URL}/${existingFileId}?uploadType=media`, content, {
            headers: { ...headers, 'Content-Type': 'application/json' }
          })
        );
        return updated.id;
      }

      const form = new FormData();
      form.append(
        'metadata',
        new Blob(
          [JSON.stringify({ name: this.SYNC_FILE_NAME, mimeType: 'application/json', parents: ['appDataFolder'] })],
          { type: 'application/json' }
        )
      );
      form.append('file', new Blob([content], { type: 'application/json' }));

      const created = await lastValueFrom(
        this.http.post<DriveFile>(`${this.UPLOAD_URL}?uploadType=multipart`, form, { headers })
      );
      return created.id;
    });
  }

  private async withAuth<T>(fn: (headers: Record<string, string>) => Promise<T>): Promise<T> {
    const token = await this.auth.getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    try {
      return await fn(headers);
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        await this.auth.invalidateToken();
        throw new GoogleAuthError('La sesión de Google expiró. Reconectá para seguir sincronizando.', true);
      }
      throw err;
    }
  }
}
