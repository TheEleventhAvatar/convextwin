import { TestCase, TestResult } from '../core/types';
export declare class TestFramework {
    private snapshotManager;
    private executionLogger;
    private stateDiffEngine;
    constructor();
    runTests(testFile?: string, verbose?: boolean): Promise<{
        total: number;
        passed: number;
        failedCount: number;
        results: TestResult[];
        passedTests: TestResult[];
        failed: Array<TestResult & {
            error: string;
        }>;
    }>;
    private findTestFiles;
    private loadTestFile;
    private runSingleTest;
    private createMockFunction;
    private getTestError;
    private deepEqual;
    createTestFile(filePath: string, testCases: TestCase[]): Promise<void>;
    validateTestFile(filePath: string): Promise<{
        valid: boolean;
        errors: string[];
    }>;
}
//# sourceMappingURL=test-framework.d.ts.map