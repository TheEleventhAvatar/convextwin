export interface ConvexTable {
  [tableName: string]: Record<string, any>[];
}

export interface DatabaseSnapshot {
  version: string;
  timestamp: string;
  tables: ConvexTable;
}

export interface FunctionContext {
  db: MockDatabase;
  auth: any;
  scheduler: any;
  storage: any;
}

export interface MockDatabase {
  get: (tableName: string) => MockTableQuery;
  query: (tableName: string) => MockTableQuery;
  insert: (tableName: string, value: any) => Promise<any>;
  patch: (tableName: string, id: string, value: any) => Promise<any>;
  replace: (tableName: string, id: string, value: any) => Promise<any>;
  delete: (tableName: string, id: string) => Promise<void>;
}

export interface MockTableQuery {
  collect: () => Promise<any[]>;
  first: () => Promise<any>;
  unique: () => Promise<any>;
  filter: (predicate: (doc: any) => boolean) => MockTableQuery;
  order: (order: 'asc' | 'desc') => MockTableQuery;
  limit: (limit: number) => MockTableQuery;
}

export interface ExecutionLog {
  id: string;
  timestamp: string;
  functionName: string;
  functionType: 'query' | 'mutation' | 'action';
  args: any;
  output: any;
  stateBefore: DatabaseSnapshot;
  stateAfter: DatabaseSnapshot;
  stateDiff: StateDiff;
  executionTime: number;
  error?: string;
}

export interface StateDiff {
  added: Record<string, any[]>;
  updated: Record<string, any[]>;
  deleted: Record<string, any[]>;
}

export interface TestCase {
  id: string;
  name: string;
  description?: string;
  initialSnapshot: DatabaseSnapshot;
  functionName: string;
  functionType: 'query' | 'mutation' | 'action';
  args: any;
  expectedOutput?: any;
  expectedState?: DatabaseSnapshot;
  shouldPass: boolean;
}

export interface TestResult {
  testCaseId: string;
  passed: boolean;
  actualOutput: any;
  expectedOutput: any;
  actualState: DatabaseSnapshot;
  expectedState: DatabaseSnapshot;
  stateDiff: StateDiff;
  error?: string;
}
