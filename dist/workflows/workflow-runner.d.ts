import { ActionEvent, DatabaseSnapshot } from '../core/types';
import { PerturbationHooks } from './perturbation-hooks';
export type WorkflowScenarioName = 'concurrent-update-conflict' | 'retry-after-partial-failure' | 'browser-agent-crud';
export interface WorkflowRunnerOptions {
    snapshotsDir?: string;
    logsDir?: string;
    perturbations?: PerturbationHooks;
}
export interface WorkflowRunResult {
    workflowSessionId: string;
    retryChainId?: string;
    events: ActionEvent[];
    finalSnapshot: DatabaseSnapshot;
    divergence?: boolean;
    conflictDetected?: boolean;
}
export declare class WorkflowRunner {
    private readonly options;
    private readonly snapshotManager;
    private readonly eventStore;
    private readonly tracker;
    private readonly perturbations;
    constructor(options?: WorkflowRunnerOptions);
    runScenario(scenarioName: WorkflowScenarioName, snapshotName?: string): Promise<WorkflowRunResult>;
    replayWorkflowSession(snapshotName: string, events: ActionEvent[]): Promise<DatabaseSnapshot>;
    private runConcurrentUpdateConflict;
    private runRetryAfterPartialFailure;
    private runBrowserAgentCrud;
}
//# sourceMappingURL=workflow-runner.d.ts.map