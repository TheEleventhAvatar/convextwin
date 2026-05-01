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
exports.TestFramework = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const snapshot_manager_1 = require("../snapshot/snapshot-manager");
const function_runner_1 = require("../runner/function-runner");
const execution_logger_1 = require("../logging/execution-logger");
const state_diff_engine_1 = require("../diff/state-diff-engine");
class TestFramework {
    constructor() {
        this.snapshotManager = new snapshot_manager_1.SnapshotManager();
        this.executionLogger = new execution_logger_1.ExecutionLogger();
        this.stateDiffEngine = new state_diff_engine_1.StateDiffEngine();
    }
    async runTests(testFile, verbose = false) {
        const testFiles = testFile ? [testFile] : await this.findTestFiles();
        const allResults = [];
        const passedTests = [];
        const failed = [];
        for (const file of testFiles) {
            try {
                const testCases = await this.loadTestFile(file);
                for (const testCase of testCases) {
                    if (verbose) {
                        console.log(`Running test: ${testCase.name}`);
                    }
                    const result = await this.runSingleTest(testCase);
                    allResults.push(result);
                    if (result.passed) {
                        passedTests.push(result);
                    }
                    else {
                        failed.push({
                            ...result,
                            error: this.getTestError(result, testCase)
                        });
                    }
                }
            }
            catch (error) {
                console.error(`Error loading test file ${file}:`, error);
            }
        }
        return {
            total: allResults.length,
            passed: passedTests.length,
            failedCount: failed.length,
            results: allResults,
            passedTests,
            failed
        };
    }
    async findTestFiles() {
        const testsDir = './tests';
        if (!await fs.pathExists(testsDir)) {
            return [];
        }
        const files = await fs.readdir(testsDir);
        return files
            .filter(file => file.endsWith('.json'))
            .map(file => path.join(testsDir, file));
    }
    async loadTestFile(filePath) {
        const content = await fs.readJSON(filePath);
        if (Array.isArray(content)) {
            return content;
        }
        else if (content.id && content.name) {
            return [content];
        }
        else {
            throw new Error(`Invalid test file format: ${filePath}`);
        }
    }
    async runSingleTest(testCase) {
        try {
            let initialSnapshot;
            if (typeof testCase.initialSnapshot === 'string') {
                initialSnapshot = await this.snapshotManager.loadSnapshot(testCase.initialSnapshot);
            }
            else {
                initialSnapshot = testCase.initialSnapshot;
            }
            const runner = new function_runner_1.FunctionRunner(initialSnapshot);
            const result = await runner.runFunction(this.createMockFunction(testCase.functionName, testCase.functionType), testCase.args, testCase.functionType);
            const stateDiff = this.stateDiffEngine.compareSnapshots(initialSnapshot, result.stateAfter);
            await this.executionLogger.logExecution(testCase.functionName, testCase.functionType, testCase.args, result.output, initialSnapshot, result.stateAfter, stateDiff, result.executionTime, result.error);
            let passed = testCase.shouldPass;
            if (testCase.expectedOutput !== undefined) {
                passed = passed && this.deepEqual(result.output, testCase.expectedOutput);
            }
            if (testCase.expectedState !== undefined) {
                const expectedDiff = this.stateDiffEngine.compareSnapshots(initialSnapshot, testCase.expectedState);
                passed = passed && this.deepEqual(stateDiff, expectedDiff);
            }
            if (result.error) {
                passed = !testCase.shouldPass;
            }
            return {
                testCaseId: testCase.id,
                passed,
                actualOutput: result.output,
                expectedOutput: testCase.expectedOutput || null,
                actualState: result.stateAfter,
                expectedState: testCase.expectedState || initialSnapshot,
                stateDiff,
                error: result.error
            };
        }
        catch (error) {
            return {
                testCaseId: testCase.id,
                passed: false,
                actualOutput: null,
                expectedOutput: testCase.expectedOutput || null,
                actualState: this.snapshotManager.createEmptySnapshot(),
                expectedState: testCase.expectedState || this.snapshotManager.createEmptySnapshot(),
                stateDiff: { added: {}, updated: {}, deleted: {} },
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    createMockFunction(functionName, functionType) {
        return async (args, ctx) => {
            switch (functionName) {
                case 'listUsers':
                    return await ctx.db.query('users').collect();
                case 'getUser':
                    const user = await ctx.db.get('users').filter((user) => user._id === args.userId).first();
                    return user;
                case 'createUser':
                    return await ctx.db.insert('users', args);
                case 'updateUser':
                    return await ctx.db.patch('users', args.userId, args.updates);
                case 'deleteUser':
                    await ctx.db.delete('users', args.userId);
                    return { success: true };
                case 'listMessages':
                    return await ctx.db.query('messages').collect();
                case 'createMessage':
                    return await ctx.db.insert('messages', args);
                default:
                    return {
                        message: `Mock function ${functionName} executed`,
                        args,
                        functionType,
                        timestamp: new Date().toISOString()
                    };
            }
        };
    }
    getTestError(result, testCase) {
        if (result.error) {
            return `Function execution failed: ${result.error}`;
        }
        if (testCase.expectedOutput !== undefined && !this.deepEqual(result.actualOutput, testCase.expectedOutput)) {
            return `Output mismatch.\nExpected: ${JSON.stringify(testCase.expectedOutput, null, 2)}\nActual: ${JSON.stringify(result.actualOutput, null, 2)}`;
        }
        if (testCase.expectedState !== undefined) {
            const expectedDiff = this.stateDiffEngine.compareSnapshots(testCase.initialSnapshot, testCase.expectedState);
            if (!this.deepEqual(result.stateDiff, expectedDiff)) {
                return `State mismatch.\nExpected diff: ${JSON.stringify(expectedDiff, null, 2)}\nActual diff: ${JSON.stringify(result.stateDiff, null, 2)}`;
            }
        }
        if (testCase.shouldPass && !result.passed) {
            return 'Test expected to pass but failed';
        }
        if (!testCase.shouldPass && result.passed) {
            return 'Test expected to fail but passed';
        }
        return 'Unknown test failure';
    }
    deepEqual(a, b) {
        if (a === b)
            return true;
        if (a === null || b === null)
            return a === b;
        if (a === undefined || b === undefined)
            return a === b;
        if (typeof a !== typeof b)
            return false;
        if (typeof a === 'object') {
            if (Array.isArray(a) !== Array.isArray(b))
                return false;
            if (Array.isArray(a)) {
                if (a.length !== b.length)
                    return false;
                for (let i = 0; i < a.length; i++) {
                    if (!this.deepEqual(a[i], b[i]))
                        return false;
                }
                return true;
            }
            const aKeys = Object.keys(a);
            const bKeys = Object.keys(b);
            if (aKeys.length !== bKeys.length)
                return false;
            for (const key of aKeys) {
                if (!bKeys.includes(key))
                    return false;
                if (!this.deepEqual(a[key], b[key]))
                    return false;
            }
            return true;
        }
        return false;
    }
    async createTestFile(filePath, testCases) {
        await fs.writeJSON(filePath, testCases, { spaces: 2 });
    }
    async validateTestFile(filePath) {
        const errors = [];
        try {
            const content = await fs.readJSON(filePath);
            const testCases = Array.isArray(content) ? content : [content];
            for (const testCase of testCases) {
                if (!testCase.id)
                    errors.push('Missing test case id');
                if (!testCase.name)
                    errors.push('Missing test case name');
                if (!testCase.functionName)
                    errors.push('Missing function name');
                if (!testCase.functionType)
                    errors.push('Missing function type');
                if (!['query', 'mutation', 'action'].includes(testCase.functionType)) {
                    errors.push('Invalid function type');
                }
                if (testCase.args === undefined)
                    errors.push('Missing args (use {} if no args)');
            }
        }
        catch (error) {
            errors.push(`Invalid JSON: ${error}`);
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
}
exports.TestFramework = TestFramework;
//# sourceMappingURL=test-framework.js.map