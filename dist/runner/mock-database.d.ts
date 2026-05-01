import { MockDatabase, MockTableQuery, ConvexTable } from '../core/types';
export declare class MockTableQueryImpl implements MockTableQuery {
    private data;
    private filters;
    constructor(data: any[]);
    collect(): Promise<any[]>;
    first(): Promise<any>;
    unique(): Promise<any>;
    filter(predicate: (doc: any) => boolean): MockTableQuery;
    order(order: 'asc' | 'desc'): MockTableQuery;
    limit(limit: number): MockTableQuery;
}
export declare class MockDatabaseImpl implements MockDatabase {
    private tables;
    constructor(tables?: ConvexTable);
    get(tableName: string): MockTableQuery;
    query(tableName: string): MockTableQuery;
    insert(tableName: string, value: any): Promise<any>;
    patch(tableName: string, id: string, value: any): Promise<any>;
    replace(tableName: string, id: string, value: any): Promise<any>;
    delete(tableName: string, id: string): Promise<void>;
    getTables(): ConvexTable;
    setTables(tables: ConvexTable): void;
    private generateId;
}
//# sourceMappingURL=mock-database.d.ts.map