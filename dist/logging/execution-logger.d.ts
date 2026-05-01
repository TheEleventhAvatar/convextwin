import { ExecutionLog, DatabaseSnapshot, StateDiff } from '../core/types';
export declare class ExecutionLogger {
    private logsDir;
    private currentSessionLogs;
    constructor(logsDir?: string);
    logExecution(functionName: string, functionType: 'query' | 'mutation' | 'action', args: any, output: any, stateBefore: DatabaseSnapshot, stateAfter: DatabaseSnapshot, stateDiff: StateDiff, executionTime: number, error?: string): Promise<string>;
    private saveLog;
    saveSessionLogs(sessionName?: string): Promise<string>;
    getLogs(date?: string): Promise<ExecutionLog[]>;
    getLogById(logId: string): Promise<ExecutionLog | null>;
    getLogsByFunction(functionName: string): Promise<ExecutionLog[]>;
    clearLogs(): Promise<void>;
    generateHumanReadableLog(log: ExecutionLog): string;
    exportLogs(format: 'json' | 'csv', outputPath: string, date?: string): Promise<void>;
    private exportLogsToCsv;
    private generateLogId;
    private sanitizeForLogging;
    private sanitizeSnapshot;
    getCurrentSessionLogs(): ExecutionLog[];
    clearCurrentSession(): void;
}
//# sourceMappingURL=execution-logger.d.ts.map