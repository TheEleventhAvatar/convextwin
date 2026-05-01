import { DatabaseSnapshot, StateDiff, ConvexTable } from '../core/types';

export class StateDiffEngine {
  compareSnapshots(before: DatabaseSnapshot, after: DatabaseSnapshot): StateDiff {
    const diff: StateDiff = {
      added: {},
      updated: {},
      deleted: {}
    };

    const allTableNames = new Set([
      ...Object.keys(before.tables),
      ...Object.keys(after.tables)
    ]);

    for (const tableName of allTableNames) {
      const beforeTable = before.tables[tableName] || [];
      const afterTable = after.tables[tableName] || [];
      
      const tableDiff = this.compareTables(beforeTable, afterTable);
      
      if (tableDiff.added.length > 0) {
        diff.added[tableName] = tableDiff.added;
      }
      
      if (tableDiff.updated.length > 0) {
        diff.updated[tableName] = tableDiff.updated;
      }
      
      if (tableDiff.deleted.length > 0) {
        diff.deleted[tableName] = tableDiff.deleted;
      }
    }

    return diff;
  }

  private compareTables(before: any[], after: any[]): {
    added: any[];
    updated: any[];
    deleted: any[];
  } {
    const beforeMap = new Map(before.map(record => [record._id, record]));
    const afterMap = new Map(after.map(record => [record._id, record]));

    const added: any[] = [];
    const updated: any[] = [];
    const deleted: any[] = [];

    for (const [id, afterRecord] of afterMap) {
      if (!beforeMap.has(id)) {
        added.push(afterRecord);
      } else {
        const beforeRecord = beforeMap.get(id)!;
        const fieldDiff = this.compareRecords(beforeRecord, afterRecord);
        
        if (fieldDiff.length > 0) {
          updated.push({
            _id: id,
            changes: fieldDiff
          });
        }
      }
    }

    for (const [id, beforeRecord] of beforeMap) {
      if (!afterMap.has(id)) {
        deleted.push(beforeRecord);
      }
    }

    return { added, updated, deleted };
  }

  private compareRecords(before: any, after: any): Array<{
    field: string;
    before: any;
    after: any;
  }> {
    const changes: Array<{ field: string; before: any; after: any }> = [];
    
    const allFields = new Set([
      ...Object.keys(before),
      ...Object.keys(after)
    ]);

    for (const field of allFields) {
      if (field === '_id') continue;
      
      const beforeValue = before[field];
      const afterValue = after[field];
      
      if (!this.deepEqual(beforeValue, afterValue)) {
        changes.push({
          field,
          before: beforeValue,
          after: afterValue
        });
      }
    }

    return changes;
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (a === null || b === null) return a === b;
    if (a === undefined || b === undefined) return a === b;
    
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      
      if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (!this.deepEqual(a[i], b[i])) return false;
        }
        return true;
      }
      
      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);
      
      if (aKeys.length !== bKeys.length) return false;
      
      for (const key of aKeys) {
        if (!bKeys.includes(key)) return false;
        if (!this.deepEqual(a[key], b[key])) return false;
      }
      
      return true;
    }
    
    return false;
  }

  generateHumanReadableDiff(diff: StateDiff): string {
    const lines: string[] = [];
    
    lines.push('=== Database State Diff ===');
    
    if (Object.keys(diff.added).length > 0) {
      lines.push('\n📝 Added Records:');
      for (const [tableName, records] of Object.entries(diff.added)) {
        lines.push(`  ${tableName}: ${records.length} records`);
        for (const record of records) {
          lines.push(`    + ${record._id}`);
        }
      }
    }
    
    if (Object.keys(diff.updated).length > 0) {
      lines.push('\n✏️  Updated Records:');
      for (const [tableName, updates] of Object.entries(diff.updated)) {
        lines.push(`  ${tableName}: ${updates.length} records`);
        for (const update of updates) {
          lines.push(`    ~ ${update._id}`);
          for (const change of update.changes) {
            lines.push(`      ${change.field}: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`);
          }
        }
      }
    }
    
    if (Object.keys(diff.deleted).length > 0) {
      lines.push('\n🗑️  Deleted Records:');
      for (const [tableName, records] of Object.entries(diff.deleted)) {
        lines.push(`  ${tableName}: ${records.length} records`);
        for (const record of records) {
          lines.push(`    - ${record._id}`);
        }
      }
    }
    
    if (Object.keys(diff.added).length === 0 && 
        Object.keys(diff.updated).length === 0 && 
        Object.keys(diff.deleted).length === 0) {
      lines.push('\n✅ No changes detected');
    }
    
    lines.push('\n========================');
    
    return lines.join('\n');
  }

  generateJsonDiff(diff: StateDiff): string {
    return JSON.stringify(diff, null, 2);
  }

  getDiffSummary(diff: StateDiff): {
    totalAdded: number;
    totalUpdated: number;
    totalDeleted: number;
    affectedTables: string[];
  } {
    const totalAdded = Object.values(diff.added).reduce((sum, records) => sum + records.length, 0);
    const totalUpdated = Object.values(diff.updated).reduce((sum, records) => sum + records.length, 0);
    const totalDeleted = Object.values(diff.deleted).reduce((sum, records) => sum + records.length, 0);
    
    const affectedTables = new Set([
      ...Object.keys(diff.added),
      ...Object.keys(diff.updated),
      ...Object.keys(diff.deleted)
    ]);

    return {
      totalAdded,
      totalUpdated,
      totalDeleted,
      affectedTables: Array.from(affectedTables)
    };
  }

  hasChanges(diff: StateDiff): boolean {
    return Object.keys(diff.added).length > 0 || 
           Object.keys(diff.updated).length > 0 || 
           Object.keys(diff.deleted).length > 0;
  }

  applyDiff(baseSnapshot: DatabaseSnapshot, diff: StateDiff): DatabaseSnapshot {
    const newTables = JSON.parse(JSON.stringify(baseSnapshot.tables));

    for (const [tableName, records] of Object.entries(diff.added)) {
      if (!newTables[tableName]) {
        newTables[tableName] = [];
      }
      newTables[tableName].push(...records);
    }

    for (const [tableName, updates] of Object.entries(diff.updated)) {
      if (!newTables[tableName]) continue;
      
      for (const update of updates) {
        const recordIndex = newTables[tableName].findIndex((record: any) => record._id === update._id);
        if (recordIndex !== -1) {
          for (const change of update.changes) {
            newTables[tableName][recordIndex][change.field] = change.after;
          }
        }
      }
    }

    for (const [tableName, records] of Object.entries(diff.deleted)) {
      if (!newTables[tableName]) continue;
      
      for (const recordToDelete of records) {
        const recordIndex = newTables[tableName].findIndex((record: any) => record._id === recordToDelete._id);
        if (recordIndex !== -1) {
          newTables[tableName].splice(recordIndex, 1);
        }
      }
    }

    return {
      ...baseSnapshot,
      timestamp: new Date().toISOString(),
      tables: newTables
    };
  }
}
