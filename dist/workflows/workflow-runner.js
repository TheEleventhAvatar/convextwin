"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowRunner = void 0;
const event_log_store_1 = require("../events/event-log-store");
const state_event_tracker_1 = require("../events/state-event-tracker");
const snapshot_manager_1 = require("../snapshot/snapshot-manager");
const mock_database_1 = require("../runner/mock-database");
const perturbation_hooks_1 = require("./perturbation-hooks");
function cloneTables(tables) {
    return JSON.parse(JSON.stringify(tables));
}
function createSessionId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function createWorkflowName(scenarioName) {
    return scenarioName.replace(/-/g, ' ');
}
class WorkflowRunner {
    constructor(options = {}) {
        this.options = options;
        this.snapshotManager = new snapshot_manager_1.SnapshotManager(options.snapshotsDir);
        this.eventStore = new event_log_store_1.EventLogStore(options.logsDir ?? './logs');
        this.tracker = new state_event_tracker_1.StateEventTracker(this.eventStore, 'default');
        this.perturbations = (0, perturbation_hooks_1.normalizePerturbationHooks)(options.perturbations);
    }
    async runScenario(scenarioName, snapshotName = 'default') {
        const workflowSessionId = createSessionId(scenarioName);
        const workflowName = createWorkflowName(scenarioName);
        const baseSnapshot = await this.snapshotManager.loadSnapshot(snapshotName);
        let currentSnapshot = {
            ...baseSnapshot,
            tables: cloneTables(baseSnapshot.tables)
        };
        this.tracker.setCurrentSnapshotId(snapshotName);
        const events = [];
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
    async replayWorkflowSession(snapshotName, events) {
        const { replayEvents } = await Promise.resolve().then(() => __importStar(require('../replay/replay-events')));
        return replayEvents(snapshotName, events, this.options.snapshotsDir ?? './snapshots');
    }
    async runConcurrentUpdateConflict(workflowSessionId, baseSnapshot) {
        const events = [];
        const tableName = 'users';
        const record = baseSnapshot.tables[tableName]?.[0];
        if (!record) {
            return { snapshot: baseSnapshot, events, divergence: false };
        }
        const staleRead = JSON.parse(JSON.stringify(record));
        const firstWrite = { ...record, name: `${record.name} (fresh)` };
        await (0, perturbation_hooks_1.applyPerturbationDelay)(this.perturbations);
        const dbAfterFirst = new mock_database_1.MockDatabaseImpl(baseSnapshot.tables);
        await dbAfterFirst.patch(tableName, record._id, { name: firstWrite.name });
        const firstUpdate = await this.tracker.logUpdate(tableName, record._id, { name: firstWrite.name }, {
            workflowSessionId,
            actionSource: 'api',
            preStateSnapshotId: 'stale-read',
            metadata: { client: 'client-a', readVersion: staleRead._creationTime }
        });
        events.push(firstUpdate);
        await (0, perturbation_hooks_1.applyPerturbationDelay)(this.perturbations);
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
        const dbAfterSecond = new mock_database_1.MockDatabaseImpl(latestTables);
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
    async runRetryAfterPartialFailure(workflowSessionId, baseSnapshot) {
        const events = [];
        const retryChainId = createSessionId('retry');
        const tableName = 'messages';
        const db = new mock_database_1.MockDatabaseImpl(baseSnapshot.tables);
        const initialRecord = baseSnapshot.tables[tableName]?.[0];
        const targetId = initialRecord?._id ?? 'retry-temp';
        const payload = { text: 'Retry completed message', status: 'confirmed' };
        await (0, perturbation_hooks_1.applyPerturbationDelay)(this.perturbations);
        events.push(await this.tracker.logRetry(tableName, targetId, payload, {
            workflowSessionId,
            retryChainId,
            attemptNumber: 1,
            actionSource: 'api',
            metadata: { stage: 'partial-failure', partialSuccess: true }
        }));
        if (initialRecord) {
            await db.patch(tableName, initialRecord._id, { status: 'pending' });
        }
        else {
            await db.insert(tableName, { ...payload, status: 'pending' });
        }
        events.push(await this.tracker.logWorkflowStep(workflowSessionId, 'partial mutation completed', payload, {
            actionSource: 'simulated-agent',
            retryChainId,
            attemptNumber: 1,
            metadata: { partialFailure: true }
        }));
        await (0, perturbation_hooks_1.applyPerturbationDelay)(this.perturbations);
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
    async runBrowserAgentCrud(workflowSessionId, baseSnapshot) {
        const events = [];
        const db = new mock_database_1.MockDatabaseImpl(baseSnapshot.tables);
        const sessionContext = {
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
exports.WorkflowRunner = WorkflowRunner;
//# sourceMappingURL=workflow-runner.js.map