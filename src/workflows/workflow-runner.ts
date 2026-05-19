import { ActionEvent, DatabaseSnapshot, ConvexTable } from '../core/types';
import { EventLogStore } from '../events/event-log-store';
import { StateEventTracker } from '../events/state-event-tracker';
import { SnapshotManager } from '../snapshot/snapshot-manager';
import { MockDatabaseImpl } from '../runner/mock-database';
import { applyPerturbationDelay, normalizePerturbationHooks, PerturbationHooks, PerturbationRuntime } from './perturbation-hooks';

export type WorkflowScenarioName =
  | 'concurrent-update-conflict'
  | 'retry-after-partial-failure'
  | 'browser-agent-crud';

export interface WorkflowRunnerOptions {
  snapshotsDir?: string;
  logsDir?: string;
  perturbations?: PerturbationHooks;
}

export interface WorkflowRunResult {
  workflowSessionId: string;
  retryChainId?: string;
  events: ActionEvent[];
  finalSnapshot: DatabaseSnapshot;
  divergence?: boolean;
  conflictDetected?: boolean;
}

interface ScenarioContext {
  workflowSessionId: string;
  retryChainId?: string;
  source: 'browser' | 'api' | 'replay' | 'simulated-agent';
}

function cloneTables(tables: ConvexTable): ConvexTable {
  return JSON.parse(JSON.stringify(tables));
}

function createSessionId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createWorkflowName(scenarioName: WorkflowScenarioName): string {
  return scenarioName.replace(/-/g, ' ');
}

export class WorkflowRunner {
  private readonly snapshotManager: SnapshotManager;
  private readonly eventStore: EventLogStore;
  private readonly tracker: StateEventTracker;
  private readonly perturbations: PerturbationRuntime;

  constructor(private readonly options: WorkflowRunnerOptions = {}) {
    this.snapshotManager = new SnapshotManager(options.snapshotsDir);
    this.eventStore = new EventLogStore(options.logsDir ?? './logs');
    this.tracker = new StateEventTracker(this.eventStore, 'default');
    this.perturbations = normalizePerturbationHooks(options.perturbations);
  }

  async runScenario(scenarioName: WorkflowScenarioName, snapshotName: string = 'default'): Promise<WorkflowRunResult> {
    const workflowSessionId = createSessionId(scenarioName);
    const workflowName = createWorkflowName(scenarioName);
    const baseSnapshot = await this.snapshotManager.loadSnapshot(snapshotName);
    let currentSnapshot: DatabaseSnapshot = {
      ...baseSnapshot,
      tables: cloneTables(baseSnapshot.tables)
    };

    this.tracker.setCurrentSnapshotId(snapshotName);
    const events: ActionEvent[] = [];
    events.push(await this.tracker.logWorkflowStart(workflowSessionId, workflowName, { actionSource: 'simulated-agent' }));

    if (scenarioName === 'concurrent-update-conflict') {
      const result = await this.runConcurrentUpdateConflict(workflowSessionId, currentSnapshot);
      currentSnapshot = result.snapshot;
      events.push(...result.events);
      return {
        workflowSessionId,
        events,
        finalSnapshot: currentSnapshot,
        divergence: result.divergence,
        conflictDetected: true
      };
    }

    if (scenarioName === 'retry-after-partial-failure') {
      const result = await this.runRetryAfterPartialFailure(workflowSessionId, currentSnapshot);
      currentSnapshot = result.snapshot;
      events.push(...result.events);
      return {
        workflowSessionId,
        retryChainId: result.retryChainId,
        events,
        finalSnapshot: currentSnapshot,
        divergence: result.divergence
      };
    }

    const result = await this.runBrowserAgentCrud(workflowSessionId, currentSnapshot);
    currentSnapshot = result.snapshot;
    events.push(...result.events);

    return {
      workflowSessionId,
      events,
      finalSnapshot: currentSnapshot,
      divergence: false
    };
  }

  async replayWorkflowSession(snapshotName: string, events: ActionEvent[]): Promise<DatabaseSnapshot> {
    const { replayEvents } = await import('../replay/replay-events');
    return replayEvents(snapshotName, events, this.options.snapshotsDir ?? './snapshots');
  }

  private async runConcurrentUpdateConflict(workflowSessionId: string, baseSnapshot: DatabaseSnapshot): Promise<{ snapshot: DatabaseSnapshot; events: ActionEvent[]; divergence: boolean }> {
    const events: ActionEvent[] = [];
    const tableName = 'users';
    const record = baseSnapshot.tables[tableName]?.[0];

    if (!record) {
      return { snapshot: baseSnapshot, events, divergence: false };
    }

    const staleRead = JSON.parse(JSON.stringify(record));
    const firstWrite = { ...record, name: `${record.name} (fresh)` };

    await applyPerturbationDelay(this.perturbations);
    const dbAfterFirst = new MockDatabaseImpl(baseSnapshot.tables);
    await dbAfterFirst.patch(tableName, record._id, { name: firstWrite.name });
    const firstUpdate = await this.tracker.logUpdate(tableName, record._id, { name: firstWrite.name }, {
      workflowSessionId,
      actionSource: 'api',
      preStateSnapshotId: 'stale-read',
      metadata: { client: 'client-a', readVersion: staleRead._creationTime }
    });
    events.push(firstUpdate);

    await applyPerturbationDelay(this.perturbations);
    const latestTables = dbAfterFirst.getTables();
    const latestRecord = latestTables[tableName]?.find(entry => entry._id === record._id);
    const stalePayload = { ...staleRead, name: `${staleRead.name} (stale)` };
    const divergence = Boolean(latestRecord && latestRecord.name !== stalePayload.name);

    if (divergence) {
      events.push(await this.tracker.logConflict(tableName, record._id, stalePayload, {
        workflowSessionId,
        actionSource: 'api',
        reason: 'stale_write',
        metadata: { client: 'client-b', observedName: staleRead.name, latestName: latestRecord?.name }
      }));
    }

    const dbAfterSecond = new MockDatabaseImpl(latestTables);
    await dbAfterSecond.patch(tableName, record._id, stalePayload);
    events.push(await this.tracker.logUpdate(tableName, record._id, stalePayload, {
      workflowSessionId,
      actionSource: 'api',
      metadata: { client: 'client-b', stale: true, divergence }
    }));

    events.push(await this.tracker.logWorkflowEnd(workflowSessionId, 'concurrent update conflict', {
      actionSource: 'simulated-agent'
    }));

    return {
      snapshot: {
        ...baseSnapshot,
        timestamp: new Date().toISOString(),
        tables: dbAfterSecond.getTables()
      },
      events,
      divergence
    };
  }

  private async runRetryAfterPartialFailure(workflowSessionId: string, baseSnapshot: DatabaseSnapshot): Promise<{ snapshot: DatabaseSnapshot; events: ActionEvent[]; retryChainId: string; divergence: boolean }> {
    const events: ActionEvent[] = [];
    const retryChainId = createSessionId('retry');
    const tableName = 'messages';
    const db = new MockDatabaseImpl(baseSnapshot.tables);
    const initialRecord = baseSnapshot.tables[tableName]?.[0];
    const targetId = initialRecord?._id ?? 'retry-temp';
    const payload = { text: 'Retry completed message', status: 'confirmed' };

    await applyPerturbationDelay(this.perturbations);
    events.push(await this.tracker.logRetry(tableName, targetId, payload, {
      workflowSessionId,
      retryChainId,
      attemptNumber: 1,
      actionSource: 'api',
      metadata: { stage: 'partial-failure', partialSuccess: true }
    }));

    if (initialRecord) {
      await db.patch(tableName, initialRecord._id, { status: 'pending' });
    } else {
      await db.insert(tableName, { ...payload, status: 'pending' });
    }

    events.push(await this.tracker.logWorkflowStep(workflowSessionId, 'partial mutation completed', payload, {
      actionSource: 'simulated-agent',
      retryChainId,
      attemptNumber: 1,
      metadata: { partialFailure: true }
    }));

    await applyPerturbationDelay(this.perturbations);
    events.push(await this.tracker.logRetry(tableName, targetId, payload, {
      workflowSessionId,
      retryChainId,
      attemptNumber: 2,
      actionSource: 'api',
      metadata: { stage: 'retry', success: true }
    }));

    const createdOrUpdated = initialRecord
      ? await db.patch(tableName, initialRecord._id, payload)
      : await db.insert(tableName, payload);

    events.push(await this.tracker.logUpdate(tableName, createdOrUpdated._id, payload, {
      workflowSessionId,
      retryChainId,
      attemptNumber: 2,
      actionSource: 'api',
      metadata: { retry: true }
    }));
    events.push(await this.tracker.logWorkflowEnd(workflowSessionId, 'retry after partial failure', {
      actionSource: 'simulated-agent'
    }));

    return {
      snapshot: {
        ...baseSnapshot,
        timestamp: new Date().toISOString(),
        tables: db.getTables()
      },
      events,
      retryChainId,
      divergence: false
    };
  }

  private async runBrowserAgentCrud(workflowSessionId: string, baseSnapshot: DatabaseSnapshot): Promise<{ snapshot: DatabaseSnapshot; events: ActionEvent[] }> {
    const events: ActionEvent[] = [];
    const db = new MockDatabaseImpl(baseSnapshot.tables);
    const sessionContext: ScenarioContext = {
      workflowSessionId,
      source: 'browser'
    };

    events.push(await this.tracker.logWorkflowStep(workflowSessionId, 'login', { user: 'browser-agent' }, {
      actionSource: 'browser',
      metadata: sessionContext
    }));

    const created = await db.insert('users', { name: 'Agent Created', email: 'agent@example.com' });
    events.push(await this.tracker.logCreate('users', created, {
      workflowSessionId,
      actionSource: 'browser',
      metadata: { ...sessionContext, step: 'create record' }
    }));

    const edited = await db.patch('users', created._id, { name: 'Agent Edited' });
    events.push(await this.tracker.logUpdate('users', edited._id, { name: 'Agent Edited' }, {
      workflowSessionId,
      actionSource: 'browser',
      metadata: { ...sessionContext, step: 'edit record' }
    }));

    await db.delete('users', edited._id);
    events.push(await this.tracker.logDelete('users', edited._id, {
      workflowSessionId,
      actionSource: 'browser',
      metadata: { ...sessionContext, step: 'delete record' }
    }));

    events.push(await this.tracker.logWorkflowEnd(workflowSessionId, 'browser agent crud', {
      actionSource: 'browser'
    }));

    return {
      snapshot: {
        ...baseSnapshot,
        timestamp: new Date().toISOString(),
        tables: db.getTables()
      },
      events
    };
  }
}
