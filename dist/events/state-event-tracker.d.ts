import { ActionEvent, ConvexTable } from '../core/types';
import { EventLogStore } from './event-log-store';
export declare class StateEventTracker {
    private readonly eventStore;
    private currentSnapshotId;
    constructor(eventStore: EventLogStore, initialSnapshotId: string);
    getCurrentSnapshotId(): string;
    setCurrentSnapshotId(snapshotId: string): void;
    logSnapshotLoad(snapshotName: string, metadata?: Record<string, any>): Promise<ActionEvent>;
    logWorkflowStart(workflowSessionId: string, workflowName: string, metadata?: Record<string, any>): Promise<ActionEvent>;
    logWorkflowStep(workflowSessionId: string, stepName: string, payload: any, metadata?: Record<string, any>): Promise<ActionEvent>;
    logWorkflowEnd(workflowSessionId: string, workflowName: string, metadata?: Record<string, any>): Promise<ActionEvent>;
    logConflict(tableName: string, recordId: string, stalePayload: any, metadata?: Record<string, any>): Promise<ActionEvent>;
    logRetry(tableName: string, recordId: string, payload: any, metadata?: Record<string, any>): Promise<ActionEvent>;
    logSnapshotSave(snapshotName: string, tables: ConvexTable, metadata?: Record<string, any>): Promise<ActionEvent>;
    logCreate(tableName: string, record: any, metadata?: Record<string, any>): Promise<ActionEvent>;
    logUpdate(tableName: string, recordId: string, changes: any, metadata?: Record<string, any>): Promise<ActionEvent>;
    logDelete(tableName: string, recordId: string, metadata?: Record<string, any>): Promise<ActionEvent>;
    private recordEvent;
}
//# sourceMappingURL=state-event-tracker.d.ts.map