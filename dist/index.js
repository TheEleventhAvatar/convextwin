"use strict";
// Main entry point for Convex Twin library
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLICommands = exports.TestFramework = exports.StateDiffEngine = exports.ExecutionLogger = exports.MockTableQueryImpl = exports.MockDatabaseImpl = exports.FunctionRunner = exports.ExportImportManager = exports.SnapshotManager = void 0;
var snapshot_manager_1 = require("./snapshot/snapshot-manager");
Object.defineProperty(exports, "SnapshotManager", { enumerable: true, get: function () { return snapshot_manager_1.SnapshotManager; } });
var export_import_1 = require("./snapshot/export-import");
Object.defineProperty(exports, "ExportImportManager", { enumerable: true, get: function () { return export_import_1.ExportImportManager; } });
var function_runner_1 = require("./runner/function-runner");
Object.defineProperty(exports, "FunctionRunner", { enumerable: true, get: function () { return function_runner_1.FunctionRunner; } });
var mock_database_1 = require("./runner/mock-database");
Object.defineProperty(exports, "MockDatabaseImpl", { enumerable: true, get: function () { return mock_database_1.MockDatabaseImpl; } });
Object.defineProperty(exports, "MockTableQueryImpl", { enumerable: true, get: function () { return mock_database_1.MockTableQueryImpl; } });
var execution_logger_1 = require("./logging/execution-logger");
Object.defineProperty(exports, "ExecutionLogger", { enumerable: true, get: function () { return execution_logger_1.ExecutionLogger; } });
var state_diff_engine_1 = require("./diff/state-diff-engine");
Object.defineProperty(exports, "StateDiffEngine", { enumerable: true, get: function () { return state_diff_engine_1.StateDiffEngine; } });
var test_framework_1 = require("./tests/test-framework");
Object.defineProperty(exports, "TestFramework", { enumerable: true, get: function () { return test_framework_1.TestFramework; } });
__exportStar(require("./core/types"), exports);
// Convenience exports for common use cases
var commands_1 = require("./cli/commands");
Object.defineProperty(exports, "CLICommands", { enumerable: true, get: function () { return commands_1.CLICommands; } });
//# sourceMappingURL=index.js.map