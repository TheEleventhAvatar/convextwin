import { FunctionContext, DatabaseSnapshot } from '../core/types';
import { MockDatabaseImpl } from './mock-database';

export interface ConvexFunction {
  (args: any, ctx: FunctionContext): any;
}

export class FunctionRunner {
  private snapshot: DatabaseSnapshot;

  constructor(snapshot: DatabaseSnapshot) {
    this.snapshot = snapshot;
  }

  async runFunction(
    func: ConvexFunction,
    args: any,
    functionType: 'query' | 'mutation' | 'action' = 'query',
    authContext: any = null
  ): Promise<{
    output: any;
    stateAfter: DatabaseSnapshot;
    executionTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const mockDb = new MockDatabaseImpl(this.snapshot.tables);
    
    const ctx: FunctionContext = {
      db: mockDb,
      auth: authContext,
      scheduler: this.createMockScheduler(),
      storage: this.createMockStorage()
    };

    let output: any;
    let error: string | undefined;

    try {
      if (functionType === 'query') {
        output = await func(args, ctx);
      } else if (functionType === 'mutation') {
        output = await func(args, ctx);
      } else if (functionType === 'action') {
        output = await func(args, ctx);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      output = null;
    }

    const executionTime = Date.now() - startTime;
    const stateAfter: DatabaseSnapshot = {
      ...this.snapshot,
      timestamp: new Date().toISOString(),
      tables: mockDb.getTables()
    };

    return {
      output,
      stateAfter,
      executionTime,
      error
    };
  }

  async runQuery(func: ConvexFunction, args: any, authContext?: any) {
    return this.runFunction(func, args, 'query', authContext);
  }

  async runMutation(func: ConvexFunction, args: any, authContext?: any) {
    return this.runFunction(func, args, 'mutation', authContext);
  }

  async runAction(func: ConvexFunction, args: any, authContext?: any) {
    return this.runFunction(func, args, 'action', authContext);
  }

  updateSnapshot(newSnapshot: DatabaseSnapshot): void {
    this.snapshot = newSnapshot;
  }

  getCurrentSnapshot(): DatabaseSnapshot {
    return this.snapshot;
  }

  private createMockScheduler() {
    return {
      runAfter: (delay: number, mutation: string, args: any) => {
        console.log(`Mock scheduler: Would run ${mutation} after ${delay}ms with args:`, args);
      },
      runAt: (time: Date, mutation: string, args: any) => {
        console.log(`Mock scheduler: Would run ${mutation} at ${time.toISOString()} with args:`, args);
      },
      cancel: (jobId: string) => {
        console.log(`Mock scheduler: Would cancel job ${jobId}`);
      }
    };
  }

  private createMockStorage() {
    return {
      get: (url: string) => {
        console.log(`Mock storage: Would get file at ${url}`);
        return Promise.resolve(null);
      },
      put: (blob: any) => {
        console.log(`Mock storage: Would store blob of size ${blob.size}`);
        return Promise.resolve(`mock-url-${Date.now()}`);
      },
      delete: (url: string) => {
        console.log(`Mock storage: Would delete file at ${url}`);
        return Promise.resolve();
      },
      getUrl: (storageId: string) => {
        console.log(`Mock storage: Would get URL for ${storageId}`);
        return `https://mock-storage-url.com/${storageId}`;
      }
    };
  }
}
