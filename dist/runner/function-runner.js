"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionRunner = void 0;
const mock_database_1 = require("./mock-database");
class FunctionRunner {
    constructor(snapshot) {
        this.snapshot = snapshot;
    }
    async runFunction(func, args, functionType = 'query', authContext = null) {
        const startTime = Date.now();
        const mockDb = new mock_database_1.MockDatabaseImpl(this.snapshot.tables);
        const ctx = {
            db: mockDb,
            auth: authContext,
            scheduler: this.createMockScheduler(),
            storage: this.createMockStorage()
        };
        let output;
        let error;
        try {
            if (functionType === 'query') {
                output = await func(args, ctx);
            }
            else if (functionType === 'mutation') {
                output = await func(args, ctx);
            }
            else if (functionType === 'action') {
                output = await func(args, ctx);
            }
        }
        catch (err) {
            error = err instanceof Error ? err.message : String(err);
            output = null;
        }
        const executionTime = Date.now() - startTime;
        const stateAfter = {
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
    async runQuery(func, args, authContext) {
        return this.runFunction(func, args, 'query', authContext);
    }
    async runMutation(func, args, authContext) {
        return this.runFunction(func, args, 'mutation', authContext);
    }
    async runAction(func, args, authContext) {
        return this.runFunction(func, args, 'action', authContext);
    }
    updateSnapshot(newSnapshot) {
        this.snapshot = newSnapshot;
    }
    getCurrentSnapshot() {
        return this.snapshot;
    }
    createMockScheduler() {
        return {
            runAfter: (delay, mutation, args) => {
                console.log(`Mock scheduler: Would run ${mutation} after ${delay}ms with args:`, args);
            },
            runAt: (time, mutation, args) => {
                console.log(`Mock scheduler: Would run ${mutation} at ${time.toISOString()} with args:`, args);
            },
            cancel: (jobId) => {
                console.log(`Mock scheduler: Would cancel job ${jobId}`);
            }
        };
    }
    createMockStorage() {
        return {
            get: (url) => {
                console.log(`Mock storage: Would get file at ${url}`);
                return Promise.resolve(null);
            },
            put: (blob) => {
                console.log(`Mock storage: Would store blob of size ${blob.size}`);
                return Promise.resolve(`mock-url-${Date.now()}`);
            },
            delete: (url) => {
                console.log(`Mock storage: Would delete file at ${url}`);
                return Promise.resolve();
            },
            getUrl: (storageId) => {
                console.log(`Mock storage: Would get URL for ${storageId}`);
                return `https://mock-storage-url.com/${storageId}`;
            }
        };
    }
}
exports.FunctionRunner = FunctionRunner;
//# sourceMappingURL=function-runner.js.map