import { ActionEvent, DatabaseSnapshot, ConvexTable } from '../core/types';
import { SnapshotManager } from '../snapshot/snapshot-manager';
import { MockDatabaseImpl } from '../runner/mock-database';

function cloneTables(tables: ConvexTable): ConvexTable {
  return JSON.parse(JSON.stringify(tables));
}

function writeTables(db: MockDatabaseImpl, tables: ConvexTable): void {
  db.setTables(tables);
}

function upsertRecord(tables: ConvexTable, tableName: string, record: any): ConvexTable {
  const nextTables = cloneTables(tables);
  if (!nextTables[tableName]) {
    nextTables[tableName] = [];
  }

  const existingIndex = nextTables[tableName].findIndex(existing => existing._id === record._id);
  if (existingIndex === -1) {
    nextTables[tableName].push(record);
  } else {
    nextTables[tableName][existingIndex] = record;
  }

  return nextTables;
}

function applyUpdate(tables: ConvexTable, tableName: string, recordId: string, changes: any, mode: 'patch' | 'replace'): ConvexTable {
  const nextTables = cloneTables(tables);
  const records = nextTables[tableName] ?? [];
  const recordIndex = records.findIndex(record => record._id === recordId);

  if (recordIndex === -1) {
    return nextTables;
  }

  if (mode === 'replace') {
    records[recordIndex] = {
      _id: recordId,
      _creationTime: records[recordIndex]._creationTime,
      ...changes
    };
  } else {
    records[recordIndex] = {
      ...records[recordIndex],
      ...changes
    };
  }

  nextTables[tableName] = records;
  return nextTables;
}

function applyDelete(tables: ConvexTable, tableName: string, recordId: string): ConvexTable {
  const nextTables = cloneTables(tables);
  const records = nextTables[tableName] ?? [];
  nextTables[tableName] = records.filter(record => record._id !== recordId);
  return nextTables;
}

export async function replayEvents(
  snapshotId: string,
  events: ActionEvent[],
  snapshotsDir: string = './snapshots'
): Promise<DatabaseSnapshot> {
  const snapshotManager = new SnapshotManager(snapshotsDir);
  const startingSnapshot = await snapshotManager.loadSnapshot(snapshotId);
  const orderedEvents = [...events].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
  });

  let snapshot: DatabaseSnapshot = {
    ...startingSnapshot,
    tables: cloneTables(startingSnapshot.tables)
  };

  for (const event of orderedEvents) {
    const db = new MockDatabaseImpl(snapshot.tables);

    if (event.actionType === 'snapshot_load') {
      const snapshotName = event.mutationPayload?.snapshotName;
      if (typeof snapshotName === 'string' && snapshotName.length > 0) {
        snapshot = await snapshotManager.loadSnapshot(snapshotName);
      }
      continue;
    }

    if (event.actionType === 'snapshot_save') {
      snapshot = {
        ...snapshot,
        timestamp: new Date().toISOString(),
        tables: db.getTables()
      };
      continue;
    }

    if (event.actionType === 'create') {
      const record = event.mutationPayload?.record ?? null;
      if (record) {
        writeTables(db, upsertRecord(snapshot.tables, event.entityName, record));
      }
    } else if (event.actionType === 'update') {
      const recordId = event.affectedRecordId;
      const changes = event.mutationPayload?.changes ?? {};
      const mode = event.mutationPayload?.mode === 'replace' ? 'replace' : 'patch';

      if (recordId) {
        writeTables(db, applyUpdate(snapshot.tables, event.entityName, recordId, changes, mode));
      }
    } else if (event.actionType === 'delete') {
      const recordId = event.affectedRecordId;
      if (recordId) {
        writeTables(db, applyDelete(snapshot.tables, event.entityName, recordId));
      }
    }

    snapshot = {
      ...snapshot,
      timestamp: new Date().toISOString(),
      tables: db.getTables()
    };
  }

  return snapshot;
}