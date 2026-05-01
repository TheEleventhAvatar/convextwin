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
exports.SnapshotManager = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
class SnapshotManager {
    constructor(baseDir = './snapshots') {
        this.snapshotsDir = path.resolve(baseDir);
        fs.ensureDirSync(this.snapshotsDir);
    }
    async saveSnapshot(name, tables) {
        const snapshot = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            tables
        };
        const filePath = path.join(this.snapshotsDir, `${name}.json`);
        await fs.writeJSON(filePath, snapshot, { spaces: 2 });
        return filePath;
    }
    async loadSnapshot(name) {
        const filePath = path.join(this.snapshotsDir, `${name}.json`);
        if (!await fs.pathExists(filePath)) {
            throw new Error(`Snapshot '${name}' not found at ${filePath}`);
        }
        return await fs.readJSON(filePath);
    }
    async listSnapshots() {
        const files = await fs.readdir(this.snapshotsDir);
        return files
            .filter(file => file.endsWith('.json'))
            .map(file => file.replace('.json', ''));
    }
    async deleteSnapshot(name) {
        const filePath = path.join(this.snapshotsDir, `${name}.json`);
        await fs.remove(filePath);
    }
    async exportSnapshot(name, exportPath) {
        const snapshot = await this.loadSnapshot(name);
        await fs.writeJSON(exportPath, snapshot, { spaces: 2 });
    }
    async importSnapshot(importPath, name) {
        if (!await fs.pathExists(importPath)) {
            throw new Error(`Import file not found: ${importPath}`);
        }
        const snapshot = await fs.readJSON(importPath);
        const snapshotName = name || path.basename(importPath, '.json');
        await this.saveSnapshot(snapshotName, snapshot.tables);
        return snapshotName;
    }
    validateSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object')
            return false;
        if (!snapshot.version || !snapshot.timestamp || !snapshot.tables)
            return false;
        if (typeof snapshot.tables !== 'object')
            return false;
        return true;
    }
    createEmptySnapshot() {
        return {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            tables: {}
        };
    }
    async resetToSnapshot(name) {
        return await this.loadSnapshot(name);
    }
}
exports.SnapshotManager = SnapshotManager;
//# sourceMappingURL=snapshot-manager.js.map