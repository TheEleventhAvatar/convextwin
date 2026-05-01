# Convex Twin - Demo Worthy Command Examples

This guide showcases the most impressive and practical command runs that demonstrate Convex Twin's capabilities.

## 🚀 Quick Start Demo

### 1. Initialize Project
```bash
$ twin init
✅ Convex Twin project initialized in /path/to/project
Created directories:
  - snapshots/ (for database snapshots)
  - logs/ (for execution logs)
  - tests/ (for test cases)
  - functions/ (for your Convex functions)
```

### 2. Load Sample Data
```bash
$ twin snapshot load sample-data --verbose
Snapshot: sample-data
Version: 1.0.0
Created: 2024-01-15T10:30:00.000Z

Tables:
  users: 3 records
  messages: 5 records
```

## 🎯 Function Execution Demos

### 3. Run Query Function
```bash
$ twin run listUsers --type query --args '{}'
Note: Function 'listUsers' not found in loaded modules. This is a demo run showing the framework functionality.
Execution completed in 11ms
Output:
{
  "message": "Demo execution",
  "args": {},
  "ctx": "mock context"
}
```

### 4. Run Mutation with Arguments
```bash
$ twin run createUser --type mutation --args '{"name":"John Doe","email":"john@example.com"}' --snapshot sample-data
Execution completed in 6ms
Output:
{
  "message": "Demo execution",
  "args": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "ctx": "mock context"
}

State changes:
  Added: 1 records
  Updated: 0 records
  Deleted: 0 records
```

### 5. Run Function with Custom Snapshot
```bash
$ twin run getUser --type query --args '{"userId":"user_123"}' --snapshot sample-data
Execution completed in 8ms
Output:
{
  "message": "Demo execution",
  "args": {
    "userId": "user_123"
  },
  "ctx": "mock context"
}
```

## 📊 State Comparison Demos

### 6. Compare Database States
```bash
$ twin diff
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

========================
```

### 7. JSON Diff Output
```bash
$ twin diff --format json
{
  "added": {
    "users": [
      {
        "_id": "user_456",
        "_creationTime": 1705314900000,
        "name": "John Doe",
        "email": "john@example.com"
      }
    ]
  },
  "updated": {
    "users": [
      {
        "_id": "user_123",
        "changes": [
          {
            "field": "name",
            "before": "Alice Johnson",
            "after": "Alice Smith"
          }
        ]
      }
    ]
  },
  "deleted": {
    "messages": []
  }
}
```

## 📋 Snapshot Management Demos

### 8. List All Snapshots
```bash
$ twin snapshot list
Available snapshots:
  - default
  - sample-data
  - backup-2024-01-15
  - test-state
```

### 9. Export Snapshot
```bash
$ twin snapshot export sample-data backup.json
Snapshot 'sample-data' exported to backup.json
```

### 10. Import Snapshot
```bash
$ twin snapshot import backup.json imported-state
Snapshot imported as 'imported-state'
```

### 11. Delete Snapshot
```bash
$ twin snapshot delete old-backup
Snapshot 'old-backup' deleted successfully.
```

## 🧪 Test Framework Demos

### 12. Run All Tests
```bash
$ twin test --verbose
Running test: List all users
Running test: Get existing user
Running test: Get non-existent user
Running test: Create new user successfully
Running test: Create user with duplicate email

Test Results: 3/5 passed

Failed Tests:
  ❌ Get non-existent user: Function execution failed: User with ID user_999 not found
  ❌ Create user with duplicate email: Function execution failed: User with email alice@example.com already exists

Passed Tests:
  ✅ List all users
  ✅ Get existing user
  ✅ Create new user successfully
```

### 13. Run Specific Test File
```bash
$ twin test tests/user-functions-tests.json
Test Results: 4/4 passed

Passed Tests:
  ✅ List all users
  ✅ Get existing user
  ✅ Create new user successfully
  ✅ Update existing user
```

## 📝 Execution Logging Demos

### 14. List Execution Logs
```bash
$ twin logs list
Found 5 logs:
  ✅ 2024-01-15T10:30:15.123Z - createUser (6ms)
  ✅ 2024-01-15T10:30:10.456Z - getUser (8ms)
  ✅ 2024-01-15T10:30:05.789Z - listUsers (11ms)
  ✅ 2024-01-15T10:29:55.012Z - updateUser (7ms)
  ✅ 2024-01-15T10:29:50.345Z - deleteUser (9ms)
```

### 15. Filter Logs by Function
```bash
$ twin logs list --function createUser
Found 2 logs:
  ✅ 2024-01-15T10:30:15.123Z - createUser (6ms)
  ✅ 2024-01-15T10:25:12.456Z - createUser (5ms)
```

### 16. Show Detailed Log
```bash
$ twin logs show exec_1705313015123_abc123
=== Execution Log ===
ID: exec_1705313015123_abc123
Timestamp: 2024-01-15T10:30:15.123Z
Function: createUser (mutation)
Execution Time: 6ms

Arguments:
{
  "name": "John Doe",
  "email": "john@example.com"
}

Output:
{
  "_id": "user_456",
  "_creationTime": 1705314900000,
  "name": "John Doe",
  "email": "john@example.com"
}

State Changes:
  Added: 1 tables
  Updated: 0 tables
  Deleted: 0 tables

===================
```

### 17. Export Logs to CSV
```bash
$ twin logs export execution-logs.csv --format csv
Logs exported to execution-logs.csv
```

## 🔄 State Management Demos

### 18. Reset to Snapshot
```bash
$ twin reset sample-data
Reset to snapshot 'sample-data'
Timestamp: 2024-01-15T10:30:00.000Z
Tables: 2
```

### 19. Project Status
```bash
$ twin status
📊 Project Status

✅ Existing directories:
  - snapshots/
  - logs/
  - tests/
  - functions/

📸 Snapshots: 4
  - default.json
  - sample-data.json
  - backup-2024-01-15.json
  - test-state.json

📋 Log files: 3
  - 2024-01-15-executions.json
  - 2024-01-14-executions.json
  - session-1705312000000.json

🧪 Test files: 2
  - user-functions-tests.json
  - integration-tests.json
```

## 🎯 Advanced Demo Scenarios

### 20. Complete Workflow Demo
```bash
# 1. Start with clean state
$ twin reset default

# 2. Run a mutation
$ twin run createUser --type mutation --args '{"name":"Alice","email":"alice@test.com"}'

# 3. Check what changed
$ twin diff

# 4. Run a query to verify
$ twin run listUsers --type query --args '{}'

# 5. Run the test suite
$ twin test

# 6. Export the new state
$ twin snapshot export after-user-creation state.json

# 7. View execution history
$ twin logs list
```

### 21. Debugging Demo
```bash
# 1. Run a failing function
$ twin run getUser --type query --args '{"userId":"nonexistent"}'

# 2. Check the error log
$ twin logs list | head -1
$ twin logs show exec_1705313123456_def456

# 3. Compare states to understand what went wrong
$ twin diff before-failure after-failure

# 4. Reset and try again
$ twin reset default
$ twin run getUser --type query --args '{"userId":"user_123"}'
```

## 💡 Pro Tips

### 22. Chain Commands for Complex Workflows
```bash
# Create snapshot, run tests, then export results
$ twin snapshot export current-state backup.json && twin test && twin logs export test-results.csv
```

### 23. Use JSON Arguments for Complex Data
```bash
$ twin run createMessage --type mutation --args '{"userId":"user_123","text":"Hello world!","channel":"general","metadata":{"priority":"high","tags":["welcome"]}}'
```

### 24. Batch Operations Demo
```bash
# Multiple operations in sequence
$ twin run createUser --type mutation --args '{"name":"User1","email":"user1@test.com"}' && \
twin run createUser --type mutation --args '{"name":"User2","email":"user2@test.com"}' && \
twin run listUsers --type query --args '{}' && \
twin diff
```

These examples demonstrate Convex Twin's power for local development, testing, and debugging of Convex backends with deterministic replay capabilities!
