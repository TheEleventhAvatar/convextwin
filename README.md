# Convex Twin

A local deterministic replay and testing environment for Convex backends. Convex Twin allows developers to simulate, replay, and test Convex queries and mutations on a snapshot of production-like data.

## Features

- **Data Snapshot Layer**: JSON-based snapshot system to store and restore Convex table data
- **Function Runner**: Local execution of Convex functions with mock context
- **Execution Logging**: Structured logging of every function run with input/output and state changes
- **State Diff Engine**: Compare database states before and after function execution
- **CLI Interface**: Developer-friendly command-line interface
- **Test Framework**: Simple test case definition and execution

## Installation

```bash
npm install -g convex-twin
```

Or clone and build locally:

```bash
git clone <repository-url>
cd convex-twin
npm install
npm run build
npm link
```

## Quick Start

### 1. Initialize a Project

```bash
twin init
```

This creates the necessary directory structure:
- `snapshots/` - Database snapshots
- `logs/` - Execution logs
- `tests/` - Test cases
- `functions/` - Your Convex functions

### 2. Load Sample Data

```bash
# Copy example data
cp examples/snapshots/sample-data.json snapshots/
cp examples/tests/user-functions-tests.json tests/
cp examples/functions/user-functions.ts functions/

# Load the snapshot
twin snapshot load sample-data
```

### 3. Run a Function

```bash
# Run a query function
twin run listUsers --type query --args '{}'

# Run a mutation with arguments
twin run createUser --type mutation --args '{"name":"John Doe","email":"john@example.com"}'
```

### 4. View State Changes

```bash
# Show diff of last execution
twin diff

# Compare two snapshots
twin diff before-snapshot after-snapshot
```

### 5. Run Tests

```bash
# Run all tests
twin test

# Run specific test file
twin test tests/user-functions-tests.json
```

## CLI Commands

### Snapshot Management

```bash
# List all snapshots
twin snapshot list

# Load and view snapshot contents
twin snapshot load <snapshot-name>
twin snapshot load <snapshot-name> --verbose

# Delete a snapshot
twin snapshot delete <snapshot-name>

# Export/import snapshots
twin snapshot export <snapshot-name> <output-file>
twin snapshot import <input-file> [snapshot-name]
```

### Function Execution

```bash
# Run a function
twin run <function-name> --args '{"key":"value"}' --type query|mutation|action

# Options:
#   --args, -a     Arguments as JSON string (default: {})
#   --snapshot, -s Snapshot to use (default: default)
#   --type, -t     Function type: query, mutation, or action (default: query)
#   --no-log       Disable execution logging
```

### State Comparison

```bash
# Compare database states
twin diff [before-snapshot] [after-snapshot]

# Options:
#   --format, -f   Output format: human or json (default: human)
```

### Test Execution

```bash
# Run tests
twin test [test-file]

# Options:
#   --verbose, -v  Verbose output
```

### Log Management

```bash
# List execution logs
twin logs list
twin logs list --date 2024-01-15
twin logs list --function createUser

# Show detailed log
twin logs show <log-id>

# Export logs
twin logs export output.json --format json
twin logs export output.csv --format csv

# Clear all logs
twin logs clear
```

### Project Management

```bash
# Initialize new project
twin init [--dir <directory>]

# Show project status
twin status
```

## Project Structure

```
your-project/
├── snapshots/           # Database snapshots
│   ├── default.json
│   └── sample-data.json
├── logs/               # Execution logs
│   ├── 2024-01-15-executions.json
│   └── session-123456.json
├── tests/              # Test cases
│   └── user-functions-tests.json
├── functions/          # Your Convex functions
│   └── user-functions.ts
└── twin.config.json    # Configuration (optional)
```

## Snapshot Format

Snapshots are JSON files with the following structure:

```json
{
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "tables": {
    "users": [
      {
        "_id": "user_123",
        "_creationTime": 1705314600000,
        "name": "Alice Johnson",
        "email": "alice@example.com"
      }
    ],
    "messages": [...]
  }
}
```

## Test Case Format

Test cases are defined as JSON files:

```json
{
  "id": "test-create-user",
  "name": "Create new user",
  "description": "Should create a new user successfully",
  "initialSnapshot": "sample-data",
  "functionName": "createUser",
  "functionType": "mutation",
  "args": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "expectedOutput": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "shouldPass": true
}
```

### Test Case Fields

- `id`: Unique identifier for the test
- `name`: Human-readable test name
- `description`: Optional test description
- `initialSnapshot`: Snapshot name or snapshot object to start from
- `functionName`: Name of function to execute
- `functionType`: `query`, `mutation`, or `action`
- `args`: Arguments to pass to the function
- `expectedOutput`: Optional expected return value
- `expectedState`: Optional expected final database state
- `shouldPass`: Whether the test is expected to pass

## Function Integration

### Mock Functions

Convex Twin provides mock implementations for common functions. You can extend the mock function registry in `src/tests/test-framework.ts`:

```typescript
private createMockFunction(functionName: string, functionType: string) {
  return async (args: any, ctx: any) => {
    switch (functionName) {
      case 'yourCustomFunction':
        return await yourImplementation(args, ctx);
      default:
        return { message: `Mock function ${functionName} executed` };
    }
  };
}
```

### Real Function Integration

To use your actual Convex functions:

1. Place your function files in the `functions/` directory
2. Import them in your test framework
3. Update the function runner to load real functions

## Deterministic Execution

Convex Twin ensures deterministic execution by:

- Using mock implementations for external services
- Providing consistent mock database behavior
- Seeding random generators
- Logging all state changes

## State Diff Output

### Human-Readable Format

```
=== Database State Diff ===

📝 Added Records:
  users: 1 records
    + user_456

✏️  Updated Records:
  users: 1 records
    ~ user_123
      name: "Alice" → "Alice Smith"

🗑️  Deleted Records:
  messages: 1 records
    - msg_001
```

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
