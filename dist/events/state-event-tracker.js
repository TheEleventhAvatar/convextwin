"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateEventTracker = void 0;
class StateEventTracker {
    constructor(eventStore, initialSnapshotId) {
        this.eventStore = eventStore;
        this.currentSnapshotId = initialSnapshotId;
    }
    getCurrentSnapshotId() {
        return this.currentSnapshotId;
    }
    setCurrentSnapshotId(snapshotId) {
        this.currentSnapshotId = snapshotId;
    }
    async logSnapshotLoad(snapshotName, metadata = {}) {
        return this.recordEvent({
            actionType: 'snapshot_load',
            entityName: 'snapshot',
            affectedRecordId: snapshotName,
            mutationPayload: { snapshotName },
            postStateSnapshotId: snapshotName,
            metadata
        });
    }
    async logWorkflowStart(workflowSessionId, workflowName, metadata = {}) {
        return this.recordEvent({
            actionType: 'workflow_start',
            entityName: 'workflow',
            affectedRecordId: workflowSessionId,
            mutationPayload: { workflowSessionId, workflowName },
            workflowSessionId,
            actionSource: metadata.actionSource ?? 'simulated-agent',
            metadata
        });
    }
    async logWorkflowStep(workflowSessionId, stepName, payload, metadata = {}) {
        return this.recordEvent({
            actionType: 'workflow_step',
            entityName: 'workflow',
            affectedRecordId: workflowSessionId,
            mutationPayload: { workflowSessionId, stepName, payload },
            workflowSessionId,
            actionSource: metadata.actionSource ?? 'simulated-agent',
            metadata
        });
    }
    async logWorkflowEnd(workflowSessionId, workflowName, metadata = {}) {
        return this.recordEvent({
            actionType: 'workflow_end',
            entityName: 'workflow',
            affectedRecordId: workflowSessionId,
            mutationPayload: { workflowSessionId, workflowName },
            workflowSessionId,
            actionSource: metadata.actionSource ?? 'simulated-agent',
            metadata
        });
    }
    async logConflict(tableName, recordId, stalePayload, metadata = {}) {
        return this.recordEvent({
            actionType: 'conflict',
            entityName: tableName,
            affectedRecordId: recordId,
            mutationPayload: {
                recordId,
                stalePayload,
                reason: metadata.reason ?? 'stale_write'
            },
            workflowSessionId: metadata.workflowSessionId,
            retryChainId: metadata.retryChainId,
            attemptNumber: metadata.attemptNumber,
            actionSource: metadata.actionSource ?? 'api',
            metadata
        });
    }
    async logRetry(tableName, recordId, payload, metadata = {}) {
        return this.recordEvent({
            actionType: 'retry',
            entityName: tableName,
            affectedRecordId: recordId,
            mutationPayload: {
                recordId,
                payload
            },
            workflowSessionId: metadata.workflowSessionId,
            retryChainId: metadata.retryChainId,
            attemptNumber: metadata.attemptNumber,
            actionSource: metadata.actionSource ?? 'api',
            metadata
        });
    }
    async logSnapshotSave(snapshotName, tables, metadata = {}) {
        return this.recordEvent({
            actionType: 'snapshot_save',
            entityName: 'snapshot',
            affectedRecordId: snapshotName,
            mutationPayload: {
                snapshotName,
                tableCount: Object.keys(tables).length,
                recordCount: Object.values(tables).reduce((total, records) => total + records.length, 0)
            },
            postStateSnapshotId: snapshotName,
            metadata
        });
    }
    async logCreate(tableName, record, metadata = {}) {
        return this.recordEvent({
            actionType: 'create',
            entityName: tableName,
            affectedRecordId: record?._id ?? null,
            mutationPayload: {
                record
            },
            metadata
        });
    }
    async logUpdate(tableName, recordId, changes, metadata = {}) {
        return this.recordEvent({
            actionType: 'update',
            entityName: tableName,
            affectedRecordId: recordId,
            mutationPayload: {
                recordId,
                changes,
                mode: metadata.mode ?? 'patch'
            },
            metadata
        });
    }
    async logDelete(tableName, recordId, metadata = {}) {
        return this.recordEvent({
            actionType: 'delete',
            entityName: tableName,
            affectedRecordId: recordId,
            mutationPayload: {
                recordId
            },
            metadata
        });
    }
    async recordEvent(input) {
        const identity = await this.eventStore.allocateEventIdentity();
        const metadata = input.metadata ?? {};
        const event = {
            eventId: identity.eventId,
            sequence: identity.sequence,
            timestamp: new Date().toISOString(),
            actionType: input.actionType,
            entityName: input.entityName,
            affectedRecordId: input.affectedRecordId,
            preStateSnapshotId: input.preStateSnapshotId ?? metadata.preStateSnapshotId ?? this.currentSnapshotId,
            postStateSnapshotId: input.postStateSnapshotId ?? metadata.postStateSnapshotId ?? identity.eventId,
            mutationPayload: input.mutationPayload,
            workflowSessionId: input.workflowSessionId ?? metadata.workflowSessionId,
            retryChainId: input.retryChainId ?? metadata.retryChainId,
            attemptNumber: input.attemptNumber ?? metadata.attemptNumber,
            actionSource: input.actionSource ?? metadata.actionSource ?? metadata.source,
            metadata
        };
        await this.eventStore.appendEvent(event);
        this.currentSnapshotId = event.postStateSnapshotId;
        return event;
    }
}
exports.StateEventTracker = StateEventTracker;
//# sourceMappingURL=state-event-tracker.js.map