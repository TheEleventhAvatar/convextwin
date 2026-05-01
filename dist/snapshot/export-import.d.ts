export declare class ExportImportManager {
    private snapshotManager;
    constructor(snapshotsDir?: string);
    exportFromConvexData(convexDataPath: string, snapshotName: string): Promise<string>;
    private parseConvexExport;
    private parseConvexDirectory;
    exportToFormat(snapshotName: string, format: 'json' | 'csv', outputPath: string): Promise<void>;
    private exportToCsv;
    importFromFormat(importPath: string, snapshotName: string, format: 'json' | 'csv'): Promise<string>;
    private parseCsvFile;
    private parseCsvLine;
}
//# sourceMappingURL=export-import.d.ts.map