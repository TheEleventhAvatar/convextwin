import { ActionEvent } from '../core/types';
export declare class EventLogStore {
    private readonly filePath;
    private events;
    constructor(baseDir?: string, fileName?: string);
    listEvents(): Promise<ActionEvent[]>;
    getEventById(eventId: string): Promise<ActionEvent | null>;
    allocateEventIdentity(): Promise<{
        eventId: string;
        sequence: number;
    }>;
    appendEvent(event: ActionEvent): Promise<ActionEvent>;
    private reload;
    private save;
}
//# sourceMappingURL=event-log-store.d.ts.map