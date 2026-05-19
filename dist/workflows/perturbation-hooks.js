"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePerturbationHooks = normalizePerturbationHooks;
exports.applyPerturbationDelay = applyPerturbationDelay;
function normalizePerturbationHooks(hooks = {}) {
    return {
        delayedWrites: hooks.delayedWrites ?? false,
        artificialLatencyMs: hooks.artificialLatencyMs ?? 0,
        staleReads: hooks.staleReads ?? false,
        concurrentMutations: hooks.concurrentMutations ?? false
    };
}
async function applyPerturbationDelay(runtime) {
    if (runtime.artificialLatencyMs <= 0) {
        return;
    }
    await new Promise(resolve => {
        setTimeout(resolve, runtime.artificialLatencyMs);
    });
}
//# sourceMappingURL=perturbation-hooks.js.map