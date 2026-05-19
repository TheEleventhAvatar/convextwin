import { ActionEvent, DatabaseSnapshot } from '../core/types';
import { replayEvents } from './replay-events';

export interface ReplayValidationResult {
  replayedSnapshot: DatabaseSnapshot;
  expectedSnapshot?: DatabaseSnapshot;
  matches: boolean;
  divergenceMarkers: string[];
}

function diffTables(expected: DatabaseSnapshot | undefined, actual: DatabaseSnapshot): string[] {
  if (!expected) {
    return [];
  }

  const markers: string[] = [];
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

export async function validateReplay(
  snapshotId: string,
  events: ActionEvent[],
  expectedSnapshot?: DatabaseSnapshot,
  snapshotsDir: string = './snapshots'
): Promise<ReplayValidationResult> {
  const replayedSnapshot = await replayEvents(snapshotId, events, snapshotsDir);
  const divergenceMarkers = diffTables(expectedSnapshot, replayedSnapshot);

  return {
    replayedSnapshot,
    expectedSnapshot,
    matches: divergenceMarkers.length === 0,
    divergenceMarkers
  };
}
