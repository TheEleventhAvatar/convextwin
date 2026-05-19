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

export function normalizePerturbationHooks(hooks: PerturbationHooks = {}): PerturbationRuntime {
  return {
    delayedWrites: hooks.delayedWrites ?? false,
    artificialLatencyMs: hooks.artificialLatencyMs ?? 0,
    staleReads: hooks.staleReads ?? false,
    concurrentMutations: hooks.concurrentMutations ?? false
  };
}

export async function applyPerturbationDelay(runtime: PerturbationRuntime): Promise<void> {
  if (runtime.artificialLatencyMs <= 0) {
    return;
  }

  await new Promise<void>(resolve => {
    setTimeout(resolve, runtime.artificialLatencyMs);
  });
}
