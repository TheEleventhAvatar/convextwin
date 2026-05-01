import * as fs from 'fs-extra';
import * as path from 'path';
import { DatabaseSnapshot, ConvexTable } from '../core/types';

export class SnapshotManager {
  private snapshotsDir: string;

  constructor(baseDir: string = './snapshots') {
    this.snapshotsDir = path.resolve(baseDir);
    fs.ensureDirSync(this.snapshotsDir);
  }

  async saveSnapshot(name: string, tables: ConvexTable): Promise<string> {
    const snapshot: DatabaseSnapshot = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      tables
    };

    const filePath = path.join(this.snapshotsDir, `${name}.json`);
    await fs.writeJSON(filePath, snapshot, { spaces: 2 });
    return filePath;
  }

  async loadSnapshot(name: string): Promise<DatabaseSnapshot> {
    const filePath = path.join(this.snapshotsDir, `${name}.json`);
    
    if (!await fs.pathExists(filePath)) {
      throw new Error(`Snapshot '${name}' not found at ${filePath}`);
    }

    return await fs.readJSON(filePath);
  }

  async listSnapshots(): Promise<string[]> {
    const files = await fs.readdir(this.snapshotsDir);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  }

  async deleteSnapshot(name: string): Promise<void> {
    const filePath = path.join(this.snapshotsDir, `${name}.json`);
    await fs.remove(filePath);
  }

  async exportSnapshot(name: string, exportPath: string): Promise<void> {
    const snapshot = await this.loadSnapshot(name);
    await fs.writeJSON(exportPath, snapshot, { spaces: 2 });
  }

  async importSnapshot(importPath: string, name?: string): Promise<string> {
    if (!await fs.pathExists(importPath)) {
      throw new Error(`Import file not found: ${importPath}`);
    }

    const snapshot = await fs.readJSON(importPath);
    const snapshotName = name || path.basename(importPath, '.json');
    
    await this.saveSnapshot(snapshotName, snapshot.tables);
    return snapshotName;
  }

  validateSnapshot(snapshot: any): boolean {
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (!snapshot.version || !snapshot.timestamp || !snapshot.tables) return false;
    if (typeof snapshot.tables !== 'object') return false;
    
    return true;
  }

  createEmptySnapshot(): DatabaseSnapshot {
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      tables: {}
    };
  }

  async resetToSnapshot(name: string): Promise<DatabaseSnapshot> {
    return await this.loadSnapshot(name);
  }
}
