import { ActionEvent, DatabaseSnapshot } from '../core/types';
export interface ReplayValidationResult {
    replayedSnapshot: DatabaseSnapshot;
    expectedSnapshot?: DatabaseSnapshot;
    matches: boolean;
    divergenceMarkers: string[];
}
export declare function validateReplay(snapshotId: string, events: ActionEvent[], expectedSnapshot?: DatabaseSnapshot, snapshotsDir?: string): Promise<ReplayValidationResult>;
//# sourceMappingURL=replay-validator.d.ts.map