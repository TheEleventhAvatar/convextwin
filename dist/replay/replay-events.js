"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayEvents = replayEvents;
const snapshot_manager_1 = require("../snapshot/snapshot-manager");
const mock_database_1 = require("../runner/mock-database");
function cloneTables(tables) {
    return JSON.parse(JSON.stringify(tables));
}
function writeTables(db, tables) {
    db.setTables(tables);
}
function upsertRecord(tables, tableName, record) {
    const nextTables = cloneTables(tables);
    if (!nextTables[tableName]) {
        nextTables[tableName] = [];
    }
    const existingIndex = nextTables[tableName].findIndex(existing => existing._id === record._id);
    if (existingIndex === -1) {
        nextTables[tableName].push(record);
    }
    else {
        nextTables[tableName][existingIndex] = record;
    }
    return nextTables;
}
function applyUpdate(tables, tableName, recordId, changes, mode) {
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
    }
    else {
        records[recordIndex] = {
            ...records[recordIndex],
            ...changes
        };
    }
    nextTables[tableName] = records;
    return nextTables;
}
function applyDelete(tables, tableName, recordId) {
    const nextTables = cloneTables(tables);
    const records = nextTables[tableName] ?? [];
    nextTables[tableName] = records.filter(record => record._id !== recordId);
    return nextTables;
}
async function replayEvents(snapshotId, events, snapshotsDir = './snapshots') {
    const snapshotManager = new snapshot_manager_1.SnapshotManager(snapshotsDir);
    const startingSnapshot = await snapshotManager.loadSnapshot(snapshotId);
    const orderedEvents = [...events].sort((left, right) => {
        if (left.sequence !== right.sequence) {
            return left.sequence - right.sequence;
        }
        return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
    });
    let snapshot = {
        ...startingSnapshot,
        tables: cloneTables(startingSnapshot.tables)
    };
    for (const event of orderedEvents) {
        const db = new mock_database_1.MockDatabaseImpl(snapshot.tables);
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
        }
        else if (event.actionType === 'update') {
            const recordId = event.affectedRecordId;
            const changes = event.mutationPayload?.changes ?? {};
            const mode = event.mutationPayload?.mode === 'replace' ? 'replace' : 'patch';
            if (recordId) {
                writeTables(db, applyUpdate(snapshot.tables, event.entityName, recordId, changes, mode));
            }
        }
        else if (event.actionType === 'delete') {
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
//# sourceMappingURL=replay-events.js.map