import * as http from 'http';
import * as path from 'path';
import { AddressInfo } from 'net';
import { EventLogStore } from '../events/event-log-store';
import { StateEventTracker } from '../events/state-event-tracker';
import { SnapshotManager } from '../snapshot/snapshot-manager';
import { DatabaseSnapshot } from '../core/types';
import { MockDatabaseImpl } from '../runner/mock-database';

interface TwinUIServerOptions {
  host?: string;
  port?: number;
  snapshotName?: string;
  snapshotsDir?: string;
  logsDir?: string;
}

interface RequestBody {
  [key: string]: any;
}

export class TwinUIServer {
  private readonly snapshotManager: SnapshotManager;
  private readonly eventStore: EventLogStore;
  private readonly eventTracker: StateEventTracker;
  private readonly host: string;
  private readonly port: number;
  private currentSnapshotName: string;
  private currentSnapshot: DatabaseSnapshot;
  private server: http.Server | null = null;

  constructor(options: TwinUIServerOptions = {}) {
    this.snapshotManager = new SnapshotManager(options.snapshotsDir);
    this.eventStore = new EventLogStore(options.logsDir ?? './logs');
    this.eventTracker = new StateEventTracker(this.eventStore, options.snapshotName ?? 'default');
    this.host = options.host ?? '127.0.0.1';
    this.port = options.port ?? 3000;
    this.currentSnapshotName = options.snapshotName ?? 'default';
    this.currentSnapshot = this.snapshotManager.createEmptySnapshot();
  }

  async start(): Promise<{ host: string; port: number; snapshotName: string }> {
    await this.loadSnapshot(this.currentSnapshotName);

    this.server = http.createServer((req, res) => {
      void this.handleRequest(req, res).catch(error => {
        this.sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
      });
    });

    await new Promise<void>((resolve) => {
      this.server?.listen(this.port, this.host, resolve);
    });

    const address = this.server.address() as AddressInfo;
    return {
      host: address.address,
      port: address.port,
      snapshotName: this.currentSnapshotName
    };
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.server?.close(error => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    this.server = null;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? `${this.host}:${this.port}`}`);
    const pathname = requestUrl.pathname;

    if (req.method === 'GET' && pathname === '/') {
      this.sendHtml(res, 200, this.renderApp());
      return;
    }

    if (req.method === 'GET' && pathname === '/api/state') {
      this.sendJson(res, 200, {
        snapshotName: this.currentSnapshotName,
        snapshot: this.currentSnapshot
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/events') {
      const events = await this.eventStore.listEvents();
      this.sendJson(res, 200, { events });
      return;
    }

    const eventMatch = pathname.match(/^\/api\/events\/([^/]+)$/);
    if (req.method === 'GET' && eventMatch) {
      const eventId = decodeURIComponent(eventMatch[1]);
      const event = await this.eventStore.getEventById(eventId);

      if (!event) {
        this.sendJson(res, 404, { error: `Event '${eventId}' not found` });
        return;
      }

      this.sendJson(res, 200, { event });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/snapshots') {
      const snapshots = await this.snapshotManager.listSnapshots();
      this.sendJson(res, 200, {
        snapshotName: this.currentSnapshotName,
        snapshots
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/reset') {
      const body = await this.readJsonBody(req);
      const snapshotName = typeof body.snapshotName === 'string' && body.snapshotName.trim().length > 0
        ? body.snapshotName.trim()
        : this.currentSnapshotName;

      await this.loadSnapshot(snapshotName);
      this.sendJson(res, 200, {
        snapshotName: this.currentSnapshotName,
        snapshot: this.currentSnapshot
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/save') {
      const body = await this.readJsonBody(req);
      const snapshotName = typeof body.snapshotName === 'string' && body.snapshotName.trim().length > 0
        ? body.snapshotName.trim()
        : this.currentSnapshotName;

      await this.snapshotManager.saveSnapshot(snapshotName, this.currentSnapshot.tables);
      await this.eventTracker.logSnapshotSave(snapshotName, this.currentSnapshot.tables, {
        source: 'ui',
        snapshotName
      });
      this.currentSnapshotName = snapshotName;

      this.sendJson(res, 200, {
        snapshotName: this.currentSnapshotName,
        snapshot: this.currentSnapshot
      });
      return;
    }

    const tableMatch = pathname.match(/^\/api\/tables\/([^/]+)$/);
    if (tableMatch) {
      const tableName = decodeURIComponent(tableMatch[1]);

      if (req.method === 'GET') {
        this.sendJson(res, 200, {
          tableName,
          records: this.getTableRecords(tableName)
        });
        return;
      }

      if (req.method === 'POST') {
        const body = this.sanitizeBody(await this.readJsonBody(req));
        const db = new MockDatabaseImpl(this.currentSnapshot.tables);
        const record = await db.insert(tableName, body);
        this.applyDatabaseState(db);
        await this.eventTracker.logCreate(tableName, record, {
          source: 'ui',
          route: 'POST /api/tables/:table'
        });

        this.sendJson(res, 201, record);
        return;
      }
    }

    const recordMatch = pathname.match(/^\/api\/tables\/([^/]+)\/([^/]+)$/);
    if (recordMatch) {
      const tableName = decodeURIComponent(recordMatch[1]);
      const recordId = decodeURIComponent(recordMatch[2]);

      if (req.method === 'PATCH') {
        const body = this.sanitizeBody(await this.readJsonBody(req));
        const db = new MockDatabaseImpl(this.currentSnapshot.tables);
        const record = await db.patch(tableName, recordId, body);
        this.applyDatabaseState(db);
        await this.eventTracker.logUpdate(tableName, recordId, body, {
          source: 'ui',
          mode: 'patch',
          route: 'PATCH /api/tables/:table/:id'
        });

        this.sendJson(res, 200, record);
        return;
      }

      if (req.method === 'PUT') {
        const body = this.sanitizeBody(await this.readJsonBody(req));
        const db = new MockDatabaseImpl(this.currentSnapshot.tables);
        const record = await db.replace(tableName, recordId, body);
        this.applyDatabaseState(db);
        await this.eventTracker.logUpdate(tableName, recordId, body, {
          source: 'ui',
          mode: 'replace',
          route: 'PUT /api/tables/:table/:id'
        });

        this.sendJson(res, 200, record);
        return;
      }

      if (req.method === 'DELETE') {
        const db = new MockDatabaseImpl(this.currentSnapshot.tables);
        await db.delete(tableName, recordId);
        this.applyDatabaseState(db);
        await this.eventTracker.logDelete(tableName, recordId, {
          source: 'ui',
          route: 'DELETE /api/tables/:table/:id'
        });

        this.sendJson(res, 200, { ok: true });
        return;
      }
    }

    this.sendJson(res, 404, { error: 'Not found' });
  }

  private async loadSnapshot(snapshotName: string): Promise<void> {
    this.currentSnapshot = await this.snapshotManager.loadSnapshot(snapshotName);
    this.currentSnapshotName = snapshotName;
    await this.eventTracker.logSnapshotLoad(snapshotName, {
      source: 'ui',
      snapshotName
    });
  }

  private applyDatabaseState(db: MockDatabaseImpl): void {
    this.currentSnapshot = {
      ...this.currentSnapshot,
      timestamp: new Date().toISOString(),
      tables: db.getTables()
    };
  }

  private getTableRecords(tableName: string): Record<string, any>[] {
    return this.currentSnapshot.tables[tableName] ?? [];
  }

  private sanitizeBody(body: RequestBody): RequestBody {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return {};
    }

    const sanitized: RequestBody = { ...body };
    delete sanitized._id;
    delete sanitized._creationTime;
    return sanitized;
  }

  private async readJsonBody(req: http.IncomingMessage): Promise<RequestBody> {
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    if (chunks.length === 0) {
      return {};
    }

    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as RequestBody;
  }

  private sendJson(res: http.ServerResponse, statusCode: number, payload: any): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload, null, 2));
  }

  private sendHtml(res: http.ServerResponse, statusCode: number, html: string): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  }

  private renderApp(): string {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Convex Twin UI</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b1020;
        --bg-soft: rgba(15, 23, 42, 0.78);
        --panel: rgba(17, 24, 39, 0.9);
        --panel-border: rgba(148, 163, 184, 0.18);
        --text: #e5eefb;
        --muted: #9fb0c9;
        --accent: #4fd1c5;
        --accent-strong: #22c55e;
        --danger: #fb7185;
        --shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(79, 209, 197, 0.14), transparent 32%),
          radial-gradient(circle at top right, rgba(34, 197, 94, 0.12), transparent 28%),
          linear-gradient(180deg, #07101f 0%, #0c1324 48%, #050814 100%);
      }
      .shell {
        max-width: 1440px;
        margin: 0 auto;
        padding: 24px;
      }
      .hero {
        display: flex;
        gap: 16px;
        justify-content: space-between;
        align-items: end;
        margin-bottom: 20px;
      }
      .hero h1 {
        margin: 0;
        font-size: clamp(28px, 4vw, 44px);
        letter-spacing: -0.04em;
      }
      .hero p {
        margin: 6px 0 0;
        color: var(--muted);
        max-width: 780px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--panel-border);
        background: rgba(15, 23, 42, 0.7);
        color: var(--text);
        padding: 10px 14px;
        border-radius: 999px;
        box-shadow: var(--shadow);
        white-space: nowrap;
      }
      .grid {
        display: grid;
        grid-template-columns: 260px minmax(0, 1fr) 420px;
        gap: 16px;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 20px;
        box-shadow: var(--shadow);
        overflow: hidden;
      }
      .panel header {
        padding: 16px 18px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .panel header h2 {
        margin: 0;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
      }
      .panel .body {
        padding: 16px 18px;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 16px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
      }
      .field label {
        font-size: 12px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--muted);
      }
      input, textarea, button {
        font: inherit;
      }
      input, textarea {
        width: 100%;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(2, 6, 23, 0.72);
        color: var(--text);
        padding: 12px 14px;
        outline: none;
      }
      textarea {
        min-height: 280px;
        resize: vertical;
      }
      input:focus, textarea:focus {
        border-color: rgba(79, 209, 197, 0.55);
        box-shadow: 0 0 0 3px rgba(79, 209, 197, 0.1);
      }
      button {
        border: 0;
        border-radius: 12px;
        padding: 11px 14px;
        color: #06111b;
        background: linear-gradient(135deg, var(--accent), #a7f3d0);
        cursor: pointer;
        transition: transform 120ms ease, filter 120ms ease;
        font-weight: 700;
      }
      button.secondary {
        background: rgba(148, 163, 184, 0.16);
        color: var(--text);
        border: 1px solid rgba(148, 163, 184, 0.18);
      }
      button.danger {
        background: linear-gradient(135deg, var(--danger), #fda4af);
      }
      button:hover { transform: translateY(-1px); filter: brightness(1.04); }
      button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
      .list {
        display: grid;
        gap: 8px;
      }
      .list button {
        text-align: left;
        background: rgba(148, 163, 184, 0.08);
        color: var(--text);
        border: 1px solid transparent;
        font-weight: 600;
      }
      .list button.active {
        border-color: rgba(79, 209, 197, 0.45);
        background: rgba(79, 209, 197, 0.12);
      }
      .meta {
        color: var(--muted);
        font-size: 13px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 12px 10px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        vertical-align: top;
        text-align: left;
        font-size: 14px;
      }
      th {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      tr.active td {
        background: rgba(79, 209, 197, 0.08);
      }
      .record-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .editor-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 12px;
      }
      .status {
        margin-top: 10px;
        color: var(--muted);
        min-height: 20px;
      }
      .stack {
        display: grid;
        gap: 12px;
      }
      .table-list {
        max-height: calc(100vh - 250px);
        overflow: auto;
        padding-right: 4px;
      }
      .record-list {
        max-height: 44vh;
        overflow: auto;
      }
      .empty {
        color: var(--muted);
        padding: 16px 0;
      }
      .timeline-grid {
        display: grid;
        grid-template-columns: minmax(0, 380px) minmax(0, 1fr);
        gap: 16px;
      }
      .timeline-list {
        max-height: 360px;
        overflow: auto;
        display: grid;
        gap: 8px;
      }
      .timeline-item {
        width: 100%;
        text-align: left;
        background: rgba(148, 163, 184, 0.08);
        color: var(--text);
        border: 1px solid transparent;
        padding: 12px 14px;
        border-radius: 14px;
      }
      .timeline-item.active {
        border-color: rgba(79, 209, 197, 0.45);
        background: rgba(79, 209, 197, 0.12);
      }
      .timeline-item small {
        display: block;
        color: var(--muted);
        margin-top: 4px;
      }
      .timeline-detail {
        display: grid;
        gap: 10px;
      }
      .detail-block {
        background: rgba(2, 6, 23, 0.72);
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 14px;
        padding: 12px 14px;
        overflow: auto;
      }
      .detail-block pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 13px;
        color: var(--text);
      }
      @media (max-width: 1180px) {
        .grid { grid-template-columns: 1fr; }
        .timeline-grid { grid-template-columns: 1fr; }
        .table-list, .record-list { max-height: none; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="hero">
        <div>
          <h1>Convex Twin UI</h1>
          <p>Inspect the cloned snapshot, switch tables, and run basic CRUD operations without any replay or perturbation layer.</p>
        </div>
        <div class="badge" id="snapshotBadge">Loading snapshot…</div>
      </div>

      <div class="toolbar panel" style="padding: 16px 18px; margin-bottom: 16px;">
        <div class="field" style="min-width: 260px; flex: 1;">
          <label for="snapshotInput">Snapshot</label>
          <input id="snapshotInput" placeholder="default" />
        </div>
        <div class="field" style="align-self: end;">
          <label>&nbsp;</label>
          <button id="loadSnapshotBtn" class="secondary">Load snapshot</button>
        </div>
        <div class="field" style="align-self: end;">
          <label>&nbsp;</label>
          <button id="refreshBtn" class="secondary">Refresh</button>
        </div>
        <div class="field" style="align-self: end;">
          <label>&nbsp;</label>
          <button id="saveSnapshotBtn">Save working copy</button>
        </div>
      </div>

      <div class="grid">
        <section class="panel">
          <header>
            <h2>Tables</h2>
            <span class="meta" id="tableCount">0 tables</span>
          </header>
          <div class="body table-list">
            <div class="list" id="tableList"></div>
          </div>
        </section>

        <section class="panel">
          <header>
            <h2 id="tableHeading">Records</h2>
            <span class="meta" id="recordCount">0 records</span>
          </header>
          <div class="body stack">
            <div class="record-list">
              <table>
                <thead>
                  <tr>
                    <th style="width: 220px;">Record</th>
                    <th>Preview</th>
                    <th style="width: 220px;">Actions</th>
                  </tr>
                </thead>
                <tbody id="recordRows"></tbody>
              </table>
              <div id="recordEmpty" class="empty" hidden>No records yet.</div>
            </div>
          </div>
        </section>

        <section class="panel">
          <header>
            <h2>Editor</h2>
            <span class="meta" id="selectionState">New record</span>
          </header>
          <div class="body stack">
            <div class="field">
              <label for="tableNameInput">Table</label>
              <input id="tableNameInput" placeholder="users" />
            </div>
            <div class="field">
              <label for="recordEditor">JSON payload</label>
              <textarea id="recordEditor" spellcheck="false"></textarea>
            </div>
            <div class="editor-actions">
              <button id="saveRecordBtn">Save record</button>
              <button id="newRecordBtn" class="secondary">New record</button>
              <button id="deleteRecordBtn" class="danger" disabled>Delete selected</button>
            </div>
            <div class="status" id="statusText"></div>
          </div>
        </section>
      </div>

      <section class="panel" style="margin-top: 16px;">
        <header>
          <h2>Event Timeline</h2>
          <span class="meta" id="eventCount">0 events</span>
        </header>
        <div class="body timeline-grid">
          <div class="timeline-list" id="eventList"></div>
          <div class="timeline-detail">
            <div class="meta" id="eventSelectionState">Select an event</div>
            <div class="detail-block">
              <pre id="eventDetail">No event selected.</pre>
            </div>
          </div>
        </div>
      </section>
    </div>

    <script>
      const state = {
        snapshotName: '',
        tables: {},
        tableNames: [],
        currentTable: '',
        selectedRecordId: '',
        events: [],
        selectedEventId: ''
      };

      const snapshotBadge = document.getElementById('snapshotBadge');
      const snapshotInput = document.getElementById('snapshotInput');
      const tableList = document.getElementById('tableList');
      const tableCount = document.getElementById('tableCount');
      const tableHeading = document.getElementById('tableHeading');
      const recordCount = document.getElementById('recordCount');
      const recordRows = document.getElementById('recordRows');
      const recordEmpty = document.getElementById('recordEmpty');
      const tableNameInput = document.getElementById('tableNameInput');
      const recordEditor = document.getElementById('recordEditor');
      const selectionState = document.getElementById('selectionState');
      const statusText = document.getElementById('statusText');
      const deleteRecordBtn = document.getElementById('deleteRecordBtn');
      const eventCount = document.getElementById('eventCount');
      const eventList = document.getElementById('eventList');
      const eventSelectionState = document.getElementById('eventSelectionState');
      const eventDetail = document.getElementById('eventDetail');

      function setStatus(message) {
        statusText.textContent = message;
      }

      async function api(path, options = {}) {
        const response = await fetch(path, {
          headers: {
            'Content-Type': 'application/json'
          },
          ...options
        });

        const text = await response.text();
        const payload = text ? JSON.parse(text) : {};

        if (!response.ok) {
          throw new Error(payload.error || 'Request failed');
        }

        return payload;
      }

      function formatPreview(record) {
        const entries = Object.entries(record).filter(([key]) => key !== '_id' && key !== '_creationTime');
        if (entries.length === 0) {
          return '{}';
        }

        return JSON.stringify(Object.fromEntries(entries.slice(0, 4)), null, 0);
      }

      function resetEditor(record = {}) {
        recordEditor.value = JSON.stringify(record, null, 2);
        selectionState.textContent = state.selectedRecordId ? 'Editing ' + state.selectedRecordId : 'New record';
        deleteRecordBtn.disabled = !state.selectedRecordId;
      }

      function syncSnapshotMeta(payload) {
        state.snapshotName = payload.snapshotName;
        state.tables = payload.snapshot.tables || {};
        state.tableNames = Object.keys(state.tables).sort();
        snapshotBadge.textContent = 'Snapshot: ' + state.snapshotName;
        snapshotInput.value = state.snapshotName;
        tableCount.textContent = state.tableNames.length + ' tables';
        if (!state.currentTable || !state.tableNames.includes(state.currentTable)) {
          state.currentTable = state.tableNames[0] || '';
        }
        tableNameInput.value = state.currentTable;
      }

      function renderTables() {
        tableList.innerHTML = '';

        if (state.tableNames.length === 0) {
          tableList.innerHTML = '<div class="empty">No tables in this snapshot.</div>';
          return;
        }

        for (const tableName of state.tableNames) {
          const button = document.createElement('button');
          button.textContent = tableName + ' (' + state.tables[tableName].length + ')';
          button.className = tableName === state.currentTable ? 'active' : '';
          button.addEventListener('click', () => {
            state.currentTable = tableName;
            state.selectedRecordId = '';
            tableNameInput.value = tableName;
            renderAll();
            resetEditor({});
          });
          tableList.appendChild(button);
        }
      }

      function renderRecords() {
        recordRows.innerHTML = '';
        const records = state.tables[state.currentTable] || [];
        recordCount.textContent = records.length + ' records';
        tableHeading.textContent = state.currentTable ? 'Records in ' + state.currentTable : 'Records';
        recordEmpty.hidden = records.length !== 0;

        if (records.length === 0) {
          return;
        }

        for (const record of records) {
          const row = document.createElement('tr');
          row.className = record._id === state.selectedRecordId ? 'active' : '';

          const idCell = document.createElement('td');
          idCell.innerHTML = '<strong>' + record._id + '</strong><br /><span class="meta">' + new Date(record._creationTime).toLocaleString() + '</span>';

          const previewCell = document.createElement('td');
          previewCell.textContent = formatPreview(record);

          const actionsCell = document.createElement('td');
          const actions = document.createElement('div');
          actions.className = 'record-actions';

          const editButton = document.createElement('button');
          editButton.textContent = 'Edit';
          editButton.className = 'secondary';
          editButton.addEventListener('click', () => {
            state.selectedRecordId = record._id;
            tableNameInput.value = state.currentTable;
            resetEditor(record);
            renderAll();
          });

          const deleteButton = document.createElement('button');
          deleteButton.textContent = 'Delete';
          deleteButton.className = 'danger';
          deleteButton.addEventListener('click', async () => {
            if (!confirm('Delete record ' + record._id + '?')) {
              return;
            }

            await api('/api/tables/' + encodeURIComponent(state.currentTable) + '/' + encodeURIComponent(record._id), { method: 'DELETE' });
            state.selectedRecordId = '';
            setStatus('Record deleted.');
            await refreshState();
          });

          actions.appendChild(editButton);
          actions.appendChild(deleteButton);
          actionsCell.appendChild(actions);

          row.appendChild(idCell);
          row.appendChild(previewCell);
          row.appendChild(actionsCell);
          recordRows.appendChild(row);
        }
      }

      function renderAll() {
        renderTables();
        renderRecords();
        deleteRecordBtn.disabled = !state.selectedRecordId;
        selectionState.textContent = state.selectedRecordId ? 'Editing ' + state.selectedRecordId : 'New record';
      }

      function renderTimeline() {
        eventList.innerHTML = '';
        eventCount.textContent = state.events.length + ' events';

        if (state.events.length === 0) {
          eventList.innerHTML = '<div class="empty">No events recorded yet.</div>';
          eventSelectionState.textContent = 'Select an event';
          eventDetail.textContent = 'No event selected.';
          return;
        }

        for (const event of state.events) {
          const button = document.createElement('button');
          button.className = 'timeline-item' + (event.eventId === state.selectedEventId ? ' active' : '');
          button.innerHTML = '<strong>' + event.actionType + '</strong> · ' + event.entityName + '<small>' + event.timestamp + (event.affectedRecordId ? ' · ' + event.affectedRecordId : '') + '</small>';
          button.addEventListener('click', () => {
            selectEvent(event.eventId);
          });
          eventList.appendChild(button);
        }
      }

      async function selectEvent(eventId) {
        if (!eventId) {
          state.selectedEventId = '';
          eventSelectionState.textContent = 'Select an event';
          eventDetail.textContent = 'No event selected.';
          renderTimeline();
          return;
        }

        const payload = await api('/api/events/' + encodeURIComponent(eventId));
        const event = payload.event;
        state.selectedEventId = event.eventId;
        eventSelectionState.textContent = event.actionType + ' · ' + event.entityName + (event.affectedRecordId ? ' · ' + event.affectedRecordId : '');
        eventDetail.textContent = JSON.stringify({
          eventId: event.eventId,
          timestamp: event.timestamp,
          actionType: event.actionType,
          entityName: event.entityName,
          affectedRecordId: event.affectedRecordId,
          preStateSnapshotId: event.preStateSnapshotId,
          postStateSnapshotId: event.postStateSnapshotId,
          mutationPayload: event.mutationPayload,
          metadata: event.metadata
        }, null, 2);
        renderTimeline();
      }

      async function refreshState() {
        const payload = await api('/api/state');
        syncSnapshotMeta(payload);
        renderAll();
        await refreshEvents();
      }

      async function refreshEvents() {
        const payload = await api('/api/events');
        state.events = payload.events || [];

        if (state.events.length === 0) {
          state.selectedEventId = '';
          renderTimeline();
          return;
        }

        const selectedExists = state.selectedEventId && state.events.some(event => event.eventId === state.selectedEventId);
        if (!selectedExists) {
          state.selectedEventId = state.events[state.events.length - 1].eventId;
        }

        renderTimeline();
        await selectEvent(state.selectedEventId);
      }

      async function loadSnapshot() {
        const snapshotName = snapshotInput.value.trim() || 'default';
        const payload = await api('/api/reset', {
          method: 'POST',
          body: JSON.stringify({ snapshotName })
        });

        state.selectedRecordId = '';
        setStatus('Loaded snapshot ' + payload.snapshotName + '.');
        syncSnapshotMeta(payload);
        resetEditor({});
        renderAll();
      }

      async function saveSnapshot() {
        const snapshotName = snapshotInput.value.trim() || state.snapshotName || 'default';
        const payload = await api('/api/save', {
          method: 'POST',
          body: JSON.stringify({ snapshotName })
        });

        setStatus('Saved working copy to ' + payload.snapshotName + '.');
        syncSnapshotMeta(payload);
        renderAll();
      }

      async function saveRecord() {
        const tableName = tableNameInput.value.trim();
        if (!tableName) {
          setStatus('Choose a table name first.');
          return;
        }

        let payload;
        try {
          payload = JSON.parse(recordEditor.value || '{}');
        } catch (error) {
          setStatus('Record JSON is invalid.');
          return;
        }

        const requestPath = state.selectedRecordId
          ? '/api/tables/' + encodeURIComponent(tableName) + '/' + encodeURIComponent(state.selectedRecordId)
          : '/api/tables/' + encodeURIComponent(tableName);

        await api(requestPath, {
          method: state.selectedRecordId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload)
        });

        setStatus(state.selectedRecordId ? 'Record updated.' : 'Record created.');
        state.selectedRecordId = '';
        await refreshState();
        resetEditor({});
      }

      async function deleteSelectedRecord() {
        if (!state.selectedRecordId || !state.currentTable) {
          return;
        }

        if (!confirm('Delete record ' + state.selectedRecordId + '?')) {
          return;
        }

        await api('/api/tables/' + encodeURIComponent(state.currentTable) + '/' + encodeURIComponent(state.selectedRecordId), {
          method: 'DELETE'
        });

        state.selectedRecordId = '';
        setStatus('Record deleted.');
        await refreshState();
        resetEditor({});
      }

      document.getElementById('loadSnapshotBtn').addEventListener('click', loadSnapshot);
      document.getElementById('refreshBtn').addEventListener('click', refreshState);
      document.getElementById('saveSnapshotBtn').addEventListener('click', saveSnapshot);
      document.getElementById('saveRecordBtn').addEventListener('click', saveRecord);
      document.getElementById('newRecordBtn').addEventListener('click', () => {
        state.selectedRecordId = '';
        resetEditor({});
        renderAll();
        setStatus('Ready for a new record.');
      });
      deleteRecordBtn.addEventListener('click', deleteSelectedRecord);

      refreshState().catch(error => {
        snapshotBadge.textContent = 'Failed to load snapshot';
        setStatus(error.message || String(error));
      });
    </script>
  </body>
</html>`;
  }
}