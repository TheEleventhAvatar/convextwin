"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateReplay = validateReplay;
const replay_events_1 = require("./replay-events");
function diffTables(expected, actual) {
    if (!expected) {
        return [];
    }
    const markers = [];
    const expectedTables = expected.tables;
    const actualTables = actual.tables;
    const tableNames = new Set([...Object.keys(expectedTables), ...Object.keys(actualTables)]);
    for (const tableName of tableNames) {
        const expectedRecords = expectedTables[tableName] ?? [];
        const actualRecords = actualTables[tableName] ?? [];
        if (JSON.stringify(expectedRecords) !== JSON.stringify(actualRecords)) {
            markers.push(`table:${tableName}`);
        }
    }
    return markers;
}
async function validateReplay(snapshotId, events, expectedSnapshot, snapshotsDir = './snapshots') {
    const replayedSnapshot = await (0, replay_events_1.replayEvents)(snapshotId, events, snapshotsDir);
    const divergenceMarkers = diffTables(expectedSnapshot, replayedSnapshot);
    return {
        replayedSnapshot,
        expectedSnapshot,
        matches: divergenceMarkers.length === 0,
        divergenceMarkers
    };
}
//# sourceMappingURL=replay-validator.js.map