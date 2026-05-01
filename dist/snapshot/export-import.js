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
exports.ExportImportManager = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const snapshot_manager_1 = require("./snapshot-manager");
class ExportImportManager {
    constructor(snapshotsDir) {
        this.snapshotManager = new snapshot_manager_1.SnapshotManager(snapshotsDir);
    }
    async exportFromConvexData(convexDataPath, snapshotName) {
        if (!await fs.pathExists(convexDataPath)) {
            throw new Error(`Convex data path not found: ${convexDataPath}`);
        }
        let tables = {};
        if (convexDataPath.endsWith('.json')) {
            const data = await fs.readJSON(convexDataPath);
            tables = this.parseConvexExport(data);
        }
        else if ((await fs.stat(convexDataPath)).isDirectory()) {
            tables = await this.parseConvexDirectory(convexDataPath);
        }
        else {
            throw new Error('Unsupported export format. Expected JSON file or directory.');
        }
        return await this.snapshotManager.saveSnapshot(snapshotName, tables);
    }
    parseConvexExport(data) {
        const tables = {};
        if (data.tables && typeof data.tables === 'object') {
            for (const [tableName, tableData] of Object.entries(data.tables)) {
                if (Array.isArray(tableData)) {
                    tables[tableName] = tableData;
                }
            }
        }
        return tables;
    }
    async parseConvexDirectory(dirPath) {
        const tables = {};
        const files = await fs.readdir(dirPath);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(dirPath, file);
                const tableData = await fs.readJSON(filePath);
                const tableName = path.basename(file, '.json');
                if (Array.isArray(tableData)) {
                    tables[tableName] = tableData;
                }
            }
        }
        return tables;
    }
    async exportToFormat(snapshotName, format, outputPath) {
        const snapshot = await this.snapshotManager.loadSnapshot(snapshotName);
        if (format === 'json') {
            await fs.writeJSON(outputPath, snapshot, { spaces: 2 });
        }
        else if (format === 'csv') {
            await this.exportToCsv(snapshot.tables, outputPath);
        }
        else {
            throw new Error(`Unsupported export format: ${format}`);
        }
    }
    async exportToCsv(tables, outputPath) {
        const csvLines = [];
        for (const [tableName, records] of Object.entries(tables)) {
            if (records.length === 0)
                continue;
            csvLines.push(`# Table: ${tableName}`);
            const headers = Object.keys(records[0]);
            csvLines.push(headers.join(','));
            for (const record of records) {
                const values = headers.map(header => {
                    const value = record[header];
                    if (value === null || value === undefined)
                        return '';
                    if (typeof value === 'string' && value.includes(',')) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return String(value);
                });
                csvLines.push(values.join(','));
            }
            csvLines.push('');
        }
        await fs.writeFile(outputPath, csvLines.join('\n'));
    }
    async importFromFormat(importPath, snapshotName, format) {
        if (format === 'json') {
            return await this.snapshotManager.importSnapshot(importPath, snapshotName);
        }
        else if (format === 'csv') {
            const tables = await this.parseCsvFile(importPath);
            return await this.snapshotManager.saveSnapshot(snapshotName, tables);
        }
        else {
            throw new Error(`Unsupported import format: ${format}`);
        }
    }
    async parseCsvFile(csvPath) {
        const content = await fs.readFile(csvPath, 'utf-8');
        const lines = content.split('\n');
        const tables = {};
        let currentTable = null;
        let headers = [];
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                if (trimmedLine.startsWith('# Table:')) {
                    currentTable = trimmedLine.replace('# Table:', '').trim();
                    tables[currentTable] = [];
                    headers = [];
                }
                continue;
            }
            if (currentTable && headers.length === 0) {
                headers = this.parseCsvLine(trimmedLine);
                continue;
            }
            if (currentTable && headers.length > 0) {
                const values = this.parseCsvLine(trimmedLine);
                const record = {};
                headers.forEach((header, index) => {
                    record[header] = values[index] || null;
                });
                tables[currentTable].push(record);
            }
        }
        return tables;
    }
    parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                }
                else {
                    inQuotes = !inQuotes;
                }
            }
            else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            }
            else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }
}
exports.ExportImportManager = ExportImportManager;
//# sourceMappingURL=export-import.js.map