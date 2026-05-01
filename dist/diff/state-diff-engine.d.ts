import { DatabaseSnapshot, StateDiff } from '../core/types';
export declare class StateDiffEngine {
    compareSnapshots(before: DatabaseSnapshot, after: DatabaseSnapshot): StateDiff;
    private compareTables;
    private compareRecords;
    private deepEqual;
    generateHumanReadableDiff(diff: StateDiff): string;
    generateJsonDiff(diff: StateDiff): string;
    getDiffSummary(diff: StateDiff): {
        totalAdded: number;
        totalUpdated: number;
        totalDeleted: number;
        affectedTables: string[];
    };
    hasChanges(diff: StateDiff): boolean;
    applyDiff(baseSnapshot: DatabaseSnapshot, diff: StateDiff): DatabaseSnapshot;
}
//# sourceMappingURL=state-diff-engine.d.ts.map