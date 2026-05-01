import { MockDatabase, MockTableQuery, ConvexTable } from '../core/types';

export class MockTableQueryImpl implements MockTableQuery {
  private data: any[];
  private filters: ((doc: any) => boolean)[] = [];

  constructor(data: any[]) {
    this.data = [...data];
  }

  collect(): Promise<any[]> {
    let result = this.data;
    
    for (const filter of this.filters) {
      result = result.filter(filter);
    }
    
    return Promise.resolve(result);
  }

  first(): Promise<any> {
    return this.collect().then(results => results[0] || null);
  }

  unique(): Promise<any> {
    return this.collect().then(results => {
      if (results.length !== 1) {
        throw new Error(`Expected exactly 1 result, got ${results.length}`);
      }
      return results[0];
    });
  }

  filter(predicate: (doc: any) => boolean): MockTableQuery {
    const newQuery = new MockTableQueryImpl(this.data);
    newQuery.filters = [...this.filters, predicate];
    return newQuery;
  }

  order(order: 'asc' | 'desc'): MockTableQuery {
    const newQuery = new MockTableQueryImpl(this.data);
    newQuery.filters = [...this.filters];
    
    const sortedData = [...this.data].sort((a, b) => {
      if (order === 'asc') {
        return a._id.localeCompare(b._id);
      } else {
        return b._id.localeCompare(a._id);
      }
    });
    
    newQuery.data = sortedData;
    return newQuery;
  }

  limit(limit: number): MockTableQuery {
    const newQuery = new MockTableQueryImpl(this.data.slice(0, limit));
    newQuery.filters = [...this.filters];
    return newQuery;
  }
}

export class MockDatabaseImpl implements MockDatabase {
  private tables: ConvexTable;

  constructor(tables: ConvexTable = {}) {
    this.tables = JSON.parse(JSON.stringify(tables));
  }

  get(tableName: string): MockTableQuery {
    const tableData = this.tables[tableName] || [];
    return new MockTableQueryImpl(tableData);
  }

  query(tableName: string): MockTableQuery {
    return this.get(tableName);
  }

  async insert(tableName: string, value: any): Promise<any> {
    if (!this.tables[tableName]) {
      this.tables[tableName] = [];
    }

    const newRecord = {
      _id: this.generateId(),
      _creationTime: Date.now(),
      ...value
    };

    this.tables[tableName].push(newRecord);
    return newRecord;
  }

  async patch(tableName: string, id: string, value: any): Promise<any> {
    if (!this.tables[tableName]) {
      throw new Error(`Table '${tableName}' does not exist`);
    }

    const recordIndex = this.tables[tableName].findIndex(record => record._id === id);
    if (recordIndex === -1) {
      throw new Error(`Record with id '${id}' not found in table '${tableName}'`);
    }

    const updatedRecord = {
      ...this.tables[tableName][recordIndex],
      ...value
    };

    this.tables[tableName][recordIndex] = updatedRecord;
    return updatedRecord;
  }

  async replace(tableName: string, id: string, value: any): Promise<any> {
    if (!this.tables[tableName]) {
      throw new Error(`Table '${tableName}' does not exist`);
    }

    const recordIndex = this.tables[tableName].findIndex(record => record._id === id);
    if (recordIndex === -1) {
      throw new Error(`Record with id '${id}' not found in table '${tableName}'`);
    }

    const replacedRecord = {
      _id: id,
      _creationTime: this.tables[tableName][recordIndex]._creationTime,
      ...value
    };

    this.tables[tableName][recordIndex] = replacedRecord;
    return replacedRecord;
  }

  async delete(tableName: string, id: string): Promise<void> {
    if (!this.tables[tableName]) {
      throw new Error(`Table '${tableName}' does not exist`);
    }

    const recordIndex = this.tables[tableName].findIndex(record => record._id === id);
    if (recordIndex === -1) {
      throw new Error(`Record with id '${id}' not found in table '${tableName}'`);
    }

    this.tables[tableName].splice(recordIndex, 1);
  }

  getTables(): ConvexTable {
    return JSON.parse(JSON.stringify(this.tables));
  }

  setTables(tables: ConvexTable): void {
    this.tables = JSON.parse(JSON.stringify(tables));
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}
