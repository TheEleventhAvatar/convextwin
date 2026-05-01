import { FunctionContext, DatabaseSnapshot } from '../core/types';
export interface ConvexFunction {
    (args: any, ctx: FunctionContext): any;
}
export declare class FunctionRunner {
    private snapshot;
    constructor(snapshot: DatabaseSnapshot);
    runFunction(func: ConvexFunction, args: any, functionType?: 'query' | 'mutation' | 'action', authContext?: any): Promise<{
        output: any;
        stateAfter: DatabaseSnapshot;
        executionTime: number;
        error?: string;
    }>;
    runQuery(func: ConvexFunction, args: any, authContext?: any): Promise<{
        output: any;
        stateAfter: DatabaseSnapshot;
        executionTime: number;
        error?: string;
    }>;
    runMutation(func: ConvexFunction, args: any, authContext?: any): Promise<{
        output: any;
        stateAfter: DatabaseSnapshot;
        executionTime: number;
        error?: string;
    }>;
    runAction(func: ConvexFunction, args: any, authContext?: any): Promise<{
        output: any;
        stateAfter: DatabaseSnapshot;
        executionTime: number;
        error?: string;
    }>;
    updateSnapshot(newSnapshot: DatabaseSnapshot): void;
    getCurrentSnapshot(): DatabaseSnapshot;
    private createMockScheduler;
    private createMockStorage;
}
//# sourceMappingURL=function-runner.d.ts.map