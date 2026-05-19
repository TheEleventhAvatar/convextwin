interface TwinUIServerOptions {
    host?: string;
    port?: number;
    snapshotName?: string;
    snapshotsDir?: string;
    logsDir?: string;
    perturbations?: {
        delayedWrites?: boolean;
        artificialLatencyMs?: number;
        staleReads?: boolean;
        concurrentMutations?: boolean;
    };
}
export declare class TwinUIServer {
    private readonly snapshotManager;
    private readonly eventStore;
    private readonly eventTracker;
    private readonly workflowRunner;
    private readonly host;
    private readonly port;
    private currentSnapshotName;
    private currentSnapshot;
    private server;
    constructor(options?: TwinUIServerOptions);
    start(): Promise<{
        host: string;
        port: number;
        snapshotName: string;
    }>;
    stop(): Promise<void>;
    private handleRequest;
    private loadSnapshot;
    private applyDatabaseState;
    private getTableRecords;
    private groupWorkflowSessions;
    private filterReplayEvents;
    private sanitizeBody;
    private readJsonBody;
    private sendJson;
    private sendHtml;
    private renderApp;
}
export {};
//# sourceMappingURL=ui-server.d.ts.map