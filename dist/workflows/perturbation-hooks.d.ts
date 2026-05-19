export interface PerturbationHooks {
    delayedWrites?: boolean;
    artificialLatencyMs?: number;
    staleReads?: boolean;
    concurrentMutations?: boolean;
}
export interface PerturbationRuntime {
    delayedWrites: boolean;
    artificialLatencyMs: number;
    staleReads: boolean;
    concurrentMutations: boolean;
}
export declare function normalizePerturbationHooks(hooks?: PerturbationHooks): PerturbationRuntime;
export declare function applyPerturbationDelay(runtime: PerturbationRuntime): Promise<void>;
//# sourceMappingURL=perturbation-hooks.d.ts.map