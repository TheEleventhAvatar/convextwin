import { DatabaseSnapshot, ConvexTable } from '../core/types';
export declare class SnapshotManager {
    private snapshotsDir;
    constructor(baseDir?: string);
    saveSnapshot(name: string, tables: ConvexTable): Promise<string>;
    loadSnapshot(name: string): Promise<DatabaseSnapshot>;
    listSnapshots(): Promise<string[]>;
    deleteSnapshot(name: string): Promise<void>;
    exportSnapshot(name: string, exportPath: string): Promise<void>;
    importSnapshot(importPath: string, name?: string): Promise<string>;
    validateSnapshot(snapshot: any): boolean;
    createEmptySnapshot(): DatabaseSnapshot;
    resetToSnapshot(name: string): Promise<DatabaseSnapshot>;
}
//# sourceMappingURL=snapshot-manager.d.ts.map