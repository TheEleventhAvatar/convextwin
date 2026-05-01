"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionLogger = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
class ExecutionLogger {
    constructor(logsDir = './logs') {
        this.currentSessionLogs = [];
        this.logsDir = path.resolve(logsDir);
        fs.ensureDirSync(this.logsDir);
    }
    async logExecution(functionName, functionType, args, output, stateBefore, stateAfter, stateDiff, executionTime, error) {
        const log = {
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
    async saveLog(log) {
        const logFileName = `${log.timestamp.split('T')[0]}-executions.json`;
        const logFilePath = path.join(this.logsDir, logFileName);
        let logs = [];
        if (await fs.pathExists(logFilePath)) {
            logs = await fs.readJSON(logFilePath);
        }
        logs.push(log);
        await fs.writeJSON(logFilePath, logs, { spaces: 2 });
    }
    async saveSessionLogs(sessionName) {
        const sessionFileName = sessionName
            ? `${sessionName}-session-${Date.now()}.json`
            : `session-${Date.now()}.json`;
        const sessionFilePath = path.join(this.logsDir, sessionFileName);
        await fs.writeJSON(sessionFilePath, this.currentSessionLogs, { spaces: 2 });
        return sessionFilePath;
    }
    async getLogs(date) {
        if (date) {
            const logFileName = `${date}-executions.json`;
            const logFilePath = path.join(this.logsDir, logFileName);
            if (!await fs.pathExists(logFilePath)) {
                return [];
            }
            return await fs.readJSON(logFilePath);
        }
        else {
            const allLogs = [];
            const files = await fs.readdir(this.logsDir);
            for (const file of files) {
                if (file.endsWith('-executions.json')) {
                    const filePath = path.join(this.logsDir, file);
                    const logs = await fs.readJSON(filePath);
                    allLogs.push(...logs);
                }
            }
            return allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
    }
    async getLogById(logId) {
        const allLogs = await this.getLogs();
        return allLogs.find(log => log.id === logId) || null;
    }
    async getLogsByFunction(functionName) {
        const allLogs = await this.getLogs();
        return allLogs.filter(log => log.functionName === functionName);
    }
    async clearLogs() {
        const files = await fs.readdir(this.logsDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                await fs.remove(path.join(this.logsDir, file));
            }
        }
        this.currentSessionLogs = [];
    }
    generateHumanReadableLog(log) {
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
    async exportLogs(format, outputPath, date) {
        const logs = await this.getLogs(date);
        if (format === 'json') {
            await fs.writeJSON(outputPath, logs, { spaces: 2 });
        }
        else if (format === 'csv') {
            await this.exportLogsToCsv(logs, outputPath);
        }
        else {
            throw new Error(`Unsupported export format: ${format}`);
        }
    }
    async exportLogsToCsv(logs, outputPath) {
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
    generateLogId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    sanitizeForLogging(obj) {
        if (obj === null || obj === undefined) {
            return null;
        }
        if (typeof obj === 'object') {
            if (Array.isArray(obj)) {
                return obj.map(item => this.sanitizeForLogging(item));
            }
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'function') {
                    sanitized[key] = '[Function]';
                }
                else if (typeof value === 'object' && value !== null) {
                    sanitized[key] = this.sanitizeForLogging(value);
                }
                else {
                    sanitized[key] = value;
                }
            }
            return sanitized;
        }
        return obj;
    }
    sanitizeSnapshot(snapshot) {
        return {
            ...snapshot,
            tables: this.sanitizeForLogging(snapshot.tables)
        };
    }
    getCurrentSessionLogs() {
        return [...this.currentSessionLogs];
    }
    clearCurrentSession() {
        this.currentSessionLogs = [];
    }
}
exports.ExecutionLogger = ExecutionLogger;
//# sourceMappingURL=execution-logger.js.map