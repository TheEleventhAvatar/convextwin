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
exports.EventLogStore = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
class EventLogStore {
    constructor(baseDir = './logs', fileName = 'action-events.json') {
        this.loaded = false;
        this.events = [];
        this.filePath = path.resolve(baseDir, fileName);
        fs.ensureDirSync(path.dirname(this.filePath));
    }
    async listEvents() {
        await this.load();
        return [...this.events].sort((left, right) => {
            if (left.sequence !== right.sequence) {
                return left.sequence - right.sequence;
            }
            return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
        });
    }
    async getEventById(eventId) {
        const events = await this.listEvents();
        return events.find(event => event.eventId === eventId) ?? null;
    }
    async allocateEventIdentity() {
        await this.load();
        const sequence = this.events.length + 1;
        return {
            sequence,
            eventId: `evt_${String(sequence).padStart(6, '0')}`
        };
    }
    async appendEvent(event) {
        await this.load();
        this.events.push(event);
        await this.save();
        return event;
    }
    async load() {
        if (this.loaded) {
            return;
        }
        if (await fs.pathExists(this.filePath)) {
            const raw = await fs.readJSON(this.filePath);
            this.events = Array.isArray(raw) ? raw : raw.events ?? [];
        }
        this.events = this.events.sort((left, right) => {
            if (left.sequence !== right.sequence) {
                return left.sequence - right.sequence;
            }
            return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
        });
        this.loaded = true;
    }
    async save() {
        const payload = {
            version: '1.0.0',
            updatedAt: new Date().toISOString(),
            events: this.events
        };
        await fs.writeJSON(this.filePath, payload, { spaces: 2 });
    }
}
exports.EventLogStore = EventLogStore;
//# sourceMappingURL=event-log-store.js.map