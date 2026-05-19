# Convex Twin

**Deterministic replay engine for Convex backends.** Debug production data locally, replay exact execution sequences, and test mutations against snapshots with controlled anomalies.

## What It Is

Convex Twin is a local sandbox for Convex backend developers that:
- Loads production-like data into JSON snapshots
- Replays exact function execution sequences deterministically
- Injects transient faults (delayed writes, stale reads, concurrent mutations) to test resilience
- Provides a web UI and CLI to inspect state transitions and function logs

**Use cases:**
- Reproduce and debug production bugs locally
- Write reproducible tests against real data
- Validate mutation safety before deployment
- Experiment with failure scenarios

---

## Why Replay & Debugging Matters

In production Convex backends, state transitions are complex:
- Mutations run concurrently and may race
- Network delays can cause stale reads
- Cascading updates across tables are hard to trace

**Without replay:** You guess at the bug, redeploy, and hope. Hours wasted.

**With Convex Twin:** Capture the exact data state before the bug, replay the same mutation 100 times, inject delays/conflicts, and watch the bug surface in isolation on your laptop.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│          Convex Twin UI Server              │
│  (HTTP API + Web Dashboard)                 │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐  ┌─────────────────┐    │
│  │ Snapshot     │  │ Workflow Runner │    │
│  │ Manager      │  │ (with perturbs) │    │
│  └──────────────┘  └─────────────────┘    │
│         │                   │              │
│         └───────┬───────────┘              │
│                 ▼                          │
│      ┌──────────────────────┐             │
│      │  Function Runner     │             │
│      │  (Mock Context)      │             │
│      └──────────────────────┘             │
│                 │                          │
│                 ▼                          │
│      ┌──────────────────────┐             │
│      │  Mock Database       │             │
│      │  (In-Memory State)   │             │
│      └──────────────────────┘             │
│                 │                          │
│                 ▼                          │
│      ┌──────────────────────┐             │
│      │  Event Log Store     │             │
│      │  (Action + Diffs)    │             │
│      └──────────────────────┘             │
│                                            │
└─────────────────────────────────────────────┘
```

---

## Workflows

### 1. Replay a Bug

```bash
# Export production snapshot
convex export snapshots/prod-2026-05-19.json

# Load snapshot
twin snapshot load prod-2026-05-19

# Replay the exact mutation that failed
twin run createOrder --snapshot prod-2026-05-19 --args '{"userId":"user_456","items":[...]}'

# Check state diff
twin diff prod-2026-05-19
```

### 2. Inject Perturbations & Test Resilience

```bash
# Run a mutation under delayed writes (500ms latency)
twin run updateInventory \
  --snapshot prod-2026-05-19 \
  --perturb delayedWrites \
  --latency 500

# Run under concurrent mutations (race condition)
twin run transfer \
  --snapshot prod-2026-05-19 \
  --perturb concurrentMutations
```

### 3. Execute Test Suite

```bash
# Run all tests against a snapshot
twin test tests/mutation-tests.json --snapshot prod-2026-05-19

# Generate coverage report
twin test tests/ --coverage
```

---

## Replay Example

**Scenario:** A user reports that their order total is wrong after updating quantities.

**Step 1: Capture the state**
```json
// snapshots/order-bug.json
{
  "orders": [
    {
      "_id": "order_123",
      "items": [{"sku": "abc", "qty": 2, "price": 10}],
      "total": 20
    }
  ]
}
```

**Step 2: Replay the mutation**
```bash
twin run updateOrderQuantity \
  --snapshot order-bug \
  --args '{"orderId":"order_123","itemSku":"abc","newQty":5}'
```

**Step 3: Inspect the log**
```json
{
  "functionName": "updateOrderQuantity",
  "args": {"orderId":"order_123","itemSku":"abc","newQty":5},
  "startTime": "2026-05-19T16:00:00Z",
  "duration": 45,
  "stateChanges": {
    "orders": {
      "updated": ["order_123"]
    }
  },
  "result": {"total": 50}
}
```

**Step 4: Compare states**
```bash
twin diff order-bug
# Shows: total: 20 → 50 ✓
```

---

## Perturbation Example

**Scenario:** Test that a payment mutation is idempotent under network delays.

```bash
# Run the same mutation 3 times with 1-second delays
for i in {1..3}; do
  twin run processPayment \
    --snapshot clean-state \
    --args '{"userId":"user_789","amount":9999}' \
    --perturb delayedWrites \
    --latency 1000
done

# Each run should produce the same result
twin logs list --function processPayment
```

**Expected logs:**
```
Run 1: amount_charged: 9999 ✓
Run 2: amount_charged: 9999 ✓ (no duplicate charge)
Run 3: amount_charged: 9999 ✓ (no duplicate charge)
```

---

## Installation & Quick Start

```bash
# Clone and install
git clone <repo>
cd convextwin
npm install
npm run build

# Start the UI server with perturbations
npm run start-ui-perturb -- --host 0.0.0.0 --port 3000 \
  --delayedWrites --staleReads --concurrentMutations --latency 1200

# Open http://localhost:3000
```

---

## Structure

```
src/
├── cli/                  # CLI commands
├── core/types.ts         # Type definitions
├── diff/                 # State diff engine
├── events/               # Event logging
├── replay/               # Replay validator
├── runner/               # Function runner + mock DB
├── snapshot/             # Snapshot manager
├── ui/                   # Web dashboard
└── workflows/            # Replay orchestration + perturbations
```

---

## Deployment

Deploy the UI to Render:

```bash
docker build -t convex-twin .
docker run -p 3000:3000 convex-twin
```

Public URL: https://convex-twin-ui-demo.onrender.com

### JSON Format

```json
{
  "added": {
    "users": [{"_id": "user_456", ...}]
  },
  "updated": {
    "users": [{
      "_id": "user_123",
      "changes": [{"field": "name", "before": "Alice", "after": "Alice Smith"}]
    }]
  },
  "deleted": {
    "messages": [{"_id": "msg_001", ...}]
  }
}
```

## Examples

### Example 1: Testing a User Creation Function

```bash
# Load initial data
twin snapshot load sample-data

# Run the function
twin run createUser --type mutation --args '{"name":"John Doe","email":"john@example.com"}'

# Check the changes
twin diff

# View detailed log
twin logs list
twin logs show <log-id>
```

### Example 2: Running Test Suite

```bash
# Run all tests with verbose output
twin test --verbose

# Run specific test file
twin test tests/user-functions-tests.json

# View test results
twin status
```

### Example 3: Export/Import Workflow

```bash
# Export current snapshot
twin snapshot export current-state backup.json

# Import to different project
cd ../other-project
twin snapshot import ../backup.json imported-state

# Reset to imported state
twin reset imported-state
```

## Configuration

You can create a `twin.config.json` file in your project root:

```json
{
  "snapshotsDir": "./snapshots",
  "logsDir": "./logs",
  "testsDir": "./tests",
  "functionsDir": "./functions",
  "defaultSnapshot": "default",
  "autoLog": true,
  "seedRandom": true,
  "randomSeed": 12345
}
```

## API Reference

### SnapshotManager

```typescript
class SnapshotManager {
  async saveSnapshot(name: string, tables: ConvexTable): Promise<string>
  async loadSnapshot(name: string): Promise<DatabaseSnapshot>
  async listSnapshots(): Promise<string[]>
  async deleteSnapshot(name: string): Promise<void>
  async exportSnapshot(name: string, exportPath: string): Promise<void>
  async importSnapshot(importPath: string, name?: string): Promise<string>
}
```

### FunctionRunner

```typescript
class FunctionRunner {
  constructor(snapshot: DatabaseSnapshot)
  async runFunction(func: ConvexFunction, args: any, functionType: string): Promise<ExecutionResult>
  async runQuery(func: ConvexFunction, args: any): Promise<ExecutionResult>
  async runMutation(func: ConvexFunction, args: any): Promise<ExecutionResult>
}
```

### StateDiffEngine

```typescript
class StateDiffEngine {
  compareSnapshots(before: DatabaseSnapshot, after: DatabaseSnapshot): StateDiff
  generateHumanReadableDiff(diff: StateDiff): string
  generateJsonDiff(diff: StateDiff): string
  getDiffSummary(diff: StateDiff): DiffSummary
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- File issues on GitHub for bugs and feature requests
- Check the examples directory for more usage patterns
- Review the test files for advanced use cases

## Roadmap

- [ ] Real-time sync with Convex backend
- [ ] Web UI for visual inspection
- [ ] Performance profiling
- [ ] Advanced mocking options
- [ ] Integration with CI/CD pipelines
