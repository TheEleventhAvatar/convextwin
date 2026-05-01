import * as fs from 'fs-extra';
import * as path from 'path';
import { SnapshotManager } from './snapshot-manager';
import { ConvexTable } from '../core/types';

export class ExportImportManager {
  private snapshotManager: SnapshotManager;

  constructor(snapshotsDir?: string) {
    this.snapshotManager = new SnapshotManager(snapshotsDir);
  }

  async exportFromConvexData(convexDataPath: string, snapshotName: string): Promise<string> {
    if (!await fs.pathExists(convexDataPath)) {
      throw new Error(`Convex data path not found: ${convexDataPath}`);
    }

    let tables: ConvexTable = {};

    if (convexDataPath.endsWith('.json')) {
      const data = await fs.readJSON(convexDataPath);
      tables = this.parseConvexExport(data);
    } else if ((await fs.stat(convexDataPath)).isDirectory()) {
      tables = await this.parseConvexDirectory(convexDataPath);
    } else {
      throw new Error('Unsupported export format. Expected JSON file or directory.');
    }

    return await this.snapshotManager.saveSnapshot(snapshotName, tables);
  }

  private parseConvexExport(data: any): ConvexTable {
    const tables: ConvexTable = {};
    
    if (data.tables && typeof data.tables === 'object') {
      for (const [tableName, tableData] of Object.entries(data.tables)) {
        if (Array.isArray(tableData)) {
          tables[tableName] = tableData;
        }
      }
    }

    return tables;
  }

  private async parseConvexDirectory(dirPath: string): Promise<ConvexTable> {
    const tables: ConvexTable = {};
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

  async exportToFormat(snapshotName: string, format: 'json' | 'csv', outputPath: string): Promise<void> {
    const snapshot = await this.snapshotManager.loadSnapshot(snapshotName);

    if (format === 'json') {
      await fs.writeJSON(outputPath, snapshot, { spaces: 2 });
    } else if (format === 'csv') {
      await this.exportToCsv(snapshot.tables, outputPath);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async exportToCsv(tables: ConvexTable, outputPath: string): Promise<void> {
    const csvLines: string[] = [];

    for (const [tableName, records] of Object.entries(tables)) {
      if (records.length === 0) continue;

      csvLines.push(`# Table: ${tableName}`);
      
      const headers = Object.keys(records[0]);
      csvLines.push(headers.join(','));

      for (const record of records) {
        const values = headers.map(header => {
          const value = record[header];
          if (value === null || value === undefined) return '';
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

  async importFromFormat(importPath: string, snapshotName: string, format: 'json' | 'csv'): Promise<string> {
    if (format === 'json') {
      return await this.snapshotManager.importSnapshot(importPath, snapshotName);
    } else if (format === 'csv') {
      const tables = await this.parseCsvFile(importPath);
      return await this.snapshotManager.saveSnapshot(snapshotName, tables);
    } else {
      throw new Error(`Unsupported import format: ${format}`);
    }
  }

  private async parseCsvFile(csvPath: string): Promise<ConvexTable> {
    const content = await fs.readFile(csvPath, 'utf-8');
    const lines = content.split('\n');
    const tables: ConvexTable = {};
    let currentTable: string | null = null;
    let headers: string[] = [];

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
        const record: any = {};
        
        headers.forEach((header, index) => {
          record[header as string] = values[index] || null;
        });

        tables[currentTable].push(record);
      }
    }

    return tables;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }
}
