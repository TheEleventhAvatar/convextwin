import { Command } from 'commander';
export declare class CLICommands {
    private snapshotManager;
    private exportImportManager;
    private executionLogger;
    private stateDiffEngine;
    private testFramework;
    constructor();
    createSnapshotCommand(): Command;
    createRunCommand(): Command;
    createDiffCommand(): Command;
    createResetCommand(): Command;
    createTestCommand(): Command;
    createLogsCommand(): Command;
}
//# sourceMappingURL=commands.d.ts.map