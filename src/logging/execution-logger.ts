import * as fs from 'fs-extra';
import * as path from 'path';
import { ExecutionLog, DatabaseSnapshot, StateDiff } from '../core/types';

export class ExecutionLogger {
  private logsDir: string;
  private currentSessionLogs: ExecutionLog[] = [];

  constructor(logsDir: string = './logs') {
    this.logsDir = path.resolve(logsDir);
    fs.ensureDirSync(this.logsDir);
  }

  async logExecution(
    functionName: string,
    functionType: 'query' | 'mutation' | 'action',
    args: any,
    output: any,
    stateBefore: DatabaseSnapshot,
    stateAfter: DatabaseSnapshot,
    stateDiff: StateDiff,
    executionTime: number,
    error?: string
  ): Promise<string> {
    const log: ExecutionLog = {
      id: this.generateLogId(),
      timestamp: new Date().toISOString(),
      functionName,
      functionType,
      args: this.sanitizeForLogging(args),
      output: this.sanitizeForLogging(output),
      stateBefore: this.sanitizeSnapshot(stateBefore),
      stateAfter: this.sanitizeSnapshot(stateAfter),
      stateDiff,
      executionTime,
      error
    };

    this.currentSessionLogs.push(log);
    await this.saveLog(log);
    
    return log.id;
  }

  private async saveLog(log: ExecutionLog): Promise<void> {
    const logFileName = `${log.timestamp.split('T')[0]}-executions.json`;
    const logFilePath = path.join(this.logsDir, logFileName);
    
    let logs: ExecutionLog[] = [];
    if (await fs.pathExists(logFilePath)) {
      logs = await fs.readJSON(logFilePath);
    }
    
    logs.push(log);
    await fs.writeJSON(logFilePath, logs, { spaces: 2 });
  }

  async saveSessionLogs(sessionName?: string): Promise<string> {
    const sessionFileName = sessionName 
      ? `${sessionName}-session-${Date.now()}.json`
      : `session-${Date.now()}.json`;
    
    const sessionFilePath = path.join(this.logsDir, sessionFileName);
    await fs.writeJSON(sessionFilePath, this.currentSessionLogs, { spaces: 2 });
    
    return sessionFilePath;
  }

  async getLogs(date?: string): Promise<ExecutionLog[]> {
    if (date) {
      const logFileName = `${date}-executions.json`;
      const logFilePath = path.join(this.logsDir, logFileName);
      
      if (!await fs.pathExists(logFilePath)) {
        return [];
      }
      
      return await fs.readJSON(logFilePath);
    } else {
      const allLogs: ExecutionLog[] = [];
      const files = await fs.readdir(this.logsDir);
      
      for (const file of files) {
        if (file.endsWith('-executions.json')) {
          const filePath = path.join(this.logsDir, file);
          const logs = await fs.readJSON(filePath);
          allLogs.push(...logs);
        }
      }
      
      return allLogs.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }
  }

  async getLogById(logId: string): Promise<ExecutionLog | null> {
    const allLogs = await this.getLogs();
    return allLogs.find(log => log.id === logId) || null;
  }

  async getLogsByFunction(functionName: string): Promise<ExecutionLog[]> {
    const allLogs = await this.getLogs();
    return allLogs.filter(log => log.functionName === functionName);
  }

  async clearLogs(): Promise<void> {
    const files = await fs.readdir(this.logsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        await fs.remove(path.join(this.logsDir, file));
      }
    }
    this.currentSessionLogs = [];
  }

  generateHumanReadableLog(log: ExecutionLog): string {
    const lines = [
      `=== Execution Log ===`,
      `ID: ${log.id}`,
      `Timestamp: ${log.timestamp}`,
      `Function: ${log.functionName} (${log.functionType})`,
      `Execution Time: ${log.executionTime}ms`,
      ``,
      `Arguments:`,
      JSON.stringify(log.args, null, 2),
      ``,
      `Output:`,
      JSON.stringify(log.output, null, 2),
      ``,
      `State Changes:`,
      `  Added: ${Object.keys(log.stateDiff.added).length} tables`,
      `  Updated: ${Object.keys(log.stateDiff.updated).length} tables`,
      `  Deleted: ${Object.keys(log.stateDiff.deleted).length} tables`,
    ];

    if (log.error) {
      lines.push(``, `Error: ${log.error}`);
    }

    lines.push(``, `===================`);
    
    return lines.join('\n');
  }

  async exportLogs(format: 'json' | 'csv', outputPath: string, date?: string): Promise<void> {
    const logs = await this.getLogs(date);
    
    if (format === 'json') {
      await fs.writeJSON(outputPath, logs, { spaces: 2 });
    } else if (format === 'csv') {
      await this.exportLogsToCsv(logs, outputPath);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async exportLogsToCsv(logs: ExecutionLog[], outputPath: string): Promise<void> {
    const headers = [
      'id', 'timestamp', 'functionName', 'functionType', 
      'executionTime', 'hasError', 'errorMessage', 
      'argsCount', 'outputType', 'tablesAdded', 'tablesUpdated', 'tablesDeleted'
    ];
    
    const rows = [headers.join(',')];
    
    for (const log of logs) {
      const row = [
        log.id,
        log.timestamp,
        log.functionName,
        log.functionType,
        log.executionTime.toString(),
        log.error ? 'true' : 'false',
        log.error ? `"${log.error.replace(/"/g, '""')}"` : '',
        Object.keys(log.args).length.toString(),
        typeof log.output,
        Object.keys(log.stateDiff.added).length.toString(),
        Object.keys(log.stateDiff.updated).length.toString(),
        Object.keys(log.stateDiff.deleted).length.toString()
      ];
      
      rows.push(row.join(','));
    }
    
    await fs.writeFile(outputPath, rows.join('\n'));
  }

  private generateLogId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private sanitizeForLogging(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (typeof obj === 'object') {
      if (Array.isArray(obj)) {
        return obj.map(item => this.sanitizeForLogging(item));
      }
      
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'function') {
          sanitized[key] = '[Function]';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeForLogging(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }
    
    return obj;
  }

  private sanitizeSnapshot(snapshot: DatabaseSnapshot): DatabaseSnapshot {
    return {
      ...snapshot,
      tables: this.sanitizeForLogging(snapshot.tables) as any
    };
  }

  getCurrentSessionLogs(): ExecutionLog[] {
    return [...this.currentSessionLogs];
  }

  clearCurrentSession(): void {
    this.currentSessionLogs = [];
  }
}
