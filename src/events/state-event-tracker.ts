import { ActionEvent, ActionEventType, ConvexTable } from '../core/types';
import { EventLogStore } from './event-log-store';

interface TrackEventInput {
  actionType: ActionEventType;
  entityName: string;
  affectedRecordId: string | null;
  mutationPayload: any;
  preStateSnapshotId?: string;
  postStateSnapshotId?: string;
  metadata?: Record<string, any>;
}

export class StateEventTracker {
  private currentSnapshotId: string;

  constructor(private readonly eventStore: EventLogStore, initialSnapshotId: string) {
    this.currentSnapshotId = initialSnapshotId;
  }

  getCurrentSnapshotId(): string {
    return this.currentSnapshotId;
  }

  setCurrentSnapshotId(snapshotId: string): void {
    this.currentSnapshotId = snapshotId;
  }

  async logSnapshotLoad(snapshotName: string, metadata: Record<string, any> = {}): Promise<ActionEvent> {
    return this.recordEvent({
      actionType: 'snapshot_load',
      entityName: 'snapshot',
      affectedRecordId: snapshotName,
      mutationPayload: { snapshotName },
      postStateSnapshotId: snapshotName,
      metadata
    });
  }

  async logSnapshotSave(snapshotName: string, tables: ConvexTable, metadata: Record<string, any> = {}): Promise<ActionEvent> {
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

  async logCreate(tableName: string, record: any, metadata: Record<string, any> = {}): Promise<ActionEvent> {
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

  async logUpdate(tableName: string, recordId: string, changes: any, metadata: Record<string, any> = {}): Promise<ActionEvent> {
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

  async logDelete(tableName: string, recordId: string, metadata: Record<string, any> = {}): Promise<ActionEvent> {
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

  private async recordEvent(input: TrackEventInput): Promise<ActionEvent> {
    const identity = await this.eventStore.allocateEventIdentity();
    const event: ActionEvent = {
      eventId: identity.eventId,
      sequence: identity.sequence,
      timestamp: new Date().toISOString(),
      actionType: input.actionType,
      entityName: input.entityName,
      affectedRecordId: input.affectedRecordId,
      preStateSnapshotId: input.preStateSnapshotId ?? this.currentSnapshotId,
      postStateSnapshotId: input.postStateSnapshotId ?? identity.eventId,
      mutationPayload: input.mutationPayload,
      metadata: input.metadata
    };

    await this.eventStore.appendEvent(event);
    this.currentSnapshotId = event.postStateSnapshotId;
    return event;
  }
}