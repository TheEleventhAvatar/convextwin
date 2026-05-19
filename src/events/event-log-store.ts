import * as fs from 'fs-extra';
import * as path from 'path';
import { ActionEvent, ActionEventLogFile } from '../core/types';

export class EventLogStore {
  private readonly filePath: string;
  private events: ActionEvent[] = [];

  constructor(baseDir: string = './logs', fileName: string = 'action-events.json') {
    this.filePath = path.resolve(baseDir, fileName);
    fs.ensureDirSync(path.dirname(this.filePath));
  }

  async listEvents(): Promise<ActionEvent[]> {
    await this.reload();
    return [...this.events].sort((left, right) => {
      if (left.sequence !== right.sequence) {
        return left.sequence - right.sequence;
      }

      return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
    });
  }

  async getEventById(eventId: string): Promise<ActionEvent | null> {
    const events = await this.listEvents();
    return events.find(event => event.eventId === eventId) ?? null;
  }

  async allocateEventIdentity(): Promise<{ eventId: string; sequence: number }> {
    await this.reload();
    const sequence = this.events.length + 1;
    return {
      sequence,
      eventId: `evt_${String(sequence).padStart(6, '0')}`
    };
  }

  async appendEvent(event: ActionEvent): Promise<ActionEvent> {
    await this.reload();
    this.events.push(event);
    await this.save();
    return event;
  }

  private async reload(): Promise<void> {
    this.events = [];
    if (await fs.pathExists(this.filePath)) {
      const raw = await fs.readJSON(this.filePath) as ActionEvent[] | ActionEventLogFile;
      this.events = Array.isArray(raw) ? raw : raw.events ?? [];
    }

    this.events = this.events.sort((left, right) => {
      if (left.sequence !== right.sequence) {
        return left.sequence - right.sequence;
      }

      return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
    });
  }

  private async save(): Promise<void> {
    const payload: ActionEventLogFile = {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      events: this.events
    };

    await fs.writeJSON(this.filePath, payload, { spaces: 2 });
  }
}