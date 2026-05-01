import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { SnapshotManager } from '../snapshot/snapshot-manager';
import { ExportImportManager } from '../snapshot/export-import';
import { FunctionRunner } from '../runner/function-runner';
import { ExecutionLogger } from '../logging/execution-logger';
import { StateDiffEngine } from '../diff/state-diff-engine';
import { TestFramework } from '../tests/test-framework';

export class CLICommands {
  private snapshotManager: SnapshotManager;
  private exportImportManager: ExportImportManager;
  private executionLogger: ExecutionLogger;
  private stateDiffEngine: StateDiffEngine;
  private testFramework: TestFramework;

  constructor() {
    this.snapshotManager = new SnapshotManager();
    this.exportImportManager = new ExportImportManager();
    this.executionLogger = new ExecutionLogger();
    this.stateDiffEngine = new StateDiffEngine();
    this.testFramework = new TestFramework();
  }

  createSnapshotCommand(): Command {
    const cmd = new Command('snapshot');
    
    cmd
      .command('list')
      .description('List all available snapshots')
      .action(async () => {
        try {
          const snapshots = await this.snapshotManager.listSnapshots();
          if (snapshots.length === 0) {
            console.log(chalk.yellow('No snapshots found.'));
            return;
          }
          
          console.log(chalk.green('Available snapshots:'));
          snapshots.forEach(name => {
            console.log(`  - ${name}`);
          });
        } catch (error) {
          console.error(chalk.red('Error listing snapshots:'), error);
        }
      });

    cmd
      .command('load <name>')
      .description('Load a snapshot and display its contents')
      .option('-v, --verbose', 'Show detailed snapshot information')
      .action(async (name, options) => {
        try {
          const snapshot = await this.snapshotManager.loadSnapshot(name);
          
          console.log(chalk.green(`Snapshot: ${name}`));
          console.log(`Version: ${snapshot.version}`);
          console.log(`Created: ${snapshot.timestamp}`);
          
          if (options.verbose) {
            console.log(chalk.blue('\nTables:'));
            for (const [tableName, records] of Object.entries(snapshot.tables)) {
              console.log(`  ${tableName}: ${records.length} records`);
              if (records.length > 0 && options.verbose) {
                console.log(`    Sample record:`, JSON.stringify(records[0], null, 4));
              }
            }
          } else {
            console.log(chalk.blue('\nTables:'));
            for (const [tableName, records] of Object.entries(snapshot.tables)) {
              console.log(`  ${tableName}: ${records.length} records`);
            }
          }
        } catch (error) {
          console.error(chalk.red('Error loading snapshot:'), error);
        }
      });

    cmd
      .command('delete <name>')
      .description('Delete a snapshot')
      .action(async (name) => {
        try {
          await this.snapshotManager.deleteSnapshot(name);
          console.log(chalk.green(`Snapshot '${name}' deleted successfully.`));
        } catch (error) {
          console.error(chalk.red('Error deleting snapshot:'), error);
        }
      });

    cmd
      .command('export <name> <path>')
      .description('Export a snapshot to a file')
      .action(async (name, exportPath) => {
        try {
          await this.snapshotManager.exportSnapshot(name, exportPath);
          console.log(chalk.green(`Snapshot '${name}' exported to ${exportPath}`));
        } catch (error) {
          console.error(chalk.red('Error exporting snapshot:'), error);
        }
      });

    cmd
      .command('import <path> [name]')
      .description('Import a snapshot from a file')
      .action(async (importPath, name) => {
        try {
          const snapshotName = await this.snapshotManager.importSnapshot(importPath, name);
          console.log(chalk.green(`Snapshot imported as '${snapshotName}'`));
        } catch (error) {
          console.error(chalk.red('Error importing snapshot:'), error);
        }
      });

    return cmd;
  }

  createRunCommand(): Command {
    const cmd = new Command('run');
    
    cmd
      .argument('<function>', 'Function name to run')
      .option('-a, --args <args>', 'Arguments as JSON string', '{}')
      .option('-s, --snapshot <name>', 'Snapshot to use', 'default')
      .option('-t, --type <type>', 'Function type (query|mutation|action)', 'query')
      .option('--no-log', 'Disable execution logging')
      .action(async (functionName, options) => {
        try {
          const args = JSON.parse(options.args);
          const snapshot = await this.snapshotManager.loadSnapshot(options.snapshot);
          
          const runner = new FunctionRunner(snapshot);
          const result = await runner.runFunction(
            async (args: any, ctx: any) => {
              console.log(chalk.yellow(`Note: Function '${functionName}' not found in loaded modules.`));
              console.log(chalk.yellow('This is a demo run showing the framework functionality.'));
              return { message: 'Demo execution', args, ctx: 'mock context' };
            },
            args,
            options.type as 'query' | 'mutation' | 'action'
          );

          const stateDiff = this.stateDiffEngine.compareSnapshots(snapshot, result.stateAfter);
          
          if (options.log) {
            await this.executionLogger.logExecution(
              functionName,
              options.type,
              args,
              result.output,
              snapshot,
              result.stateAfter,
              stateDiff,
              result.executionTime,
              result.error
            );
          }

          console.log(chalk.green(`\nExecution completed in ${result.executionTime}ms`));
          
          if (result.error) {
            console.log(chalk.red('Error:'), result.error);
          } else {
            console.log(chalk.blue('Output:'));
            console.log(JSON.stringify(result.output, null, 2));
          }

          const summary = this.stateDiffEngine.getDiffSummary(stateDiff);
          if (summary.totalAdded > 0 || summary.totalUpdated > 0 || summary.totalDeleted > 0) {
            console.log(chalk.yellow('\nState changes:'));
            console.log(`  Added: ${summary.totalAdded} records`);
            console.log(`  Updated: ${summary.totalUpdated} records`);
            console.log(`  Deleted: ${summary.totalDeleted} records`);
          }

        } catch (error) {
          console.error(chalk.red('Error running function:'), error);
        }
      });

    return cmd;
  }

  createDiffCommand(): Command {
    const cmd = new Command('diff');
    
    cmd
      .argument('[before]', 'Before snapshot name (default: current state)')
      .argument('[after]', 'After snapshot name (default: current state)')
      .option('-f, --format <format>', 'Output format (human|json)', 'human')
      .action(async (before, after, options) => {
        try {
          let beforeSnapshot, afterSnapshot;
          
          if (before && after) {
            beforeSnapshot = await this.snapshotManager.loadSnapshot(before);
            afterSnapshot = await this.snapshotManager.loadSnapshot(after);
          } else {
            console.log(chalk.yellow('Diff requires two snapshot names. Showing latest execution diff...'));
            const logs = await this.executionLogger.getLogs();
            if (logs.length === 0) {
              console.log(chalk.yellow('No execution logs found.'));
              return;
            }
            
            const latestLog = logs[0];
            beforeSnapshot = latestLog.stateBefore;
            afterSnapshot = latestLog.stateAfter;
          }

          const diff = this.stateDiffEngine.compareSnapshots(beforeSnapshot, afterSnapshot);
          
          if (options.format === 'json') {
            console.log(this.stateDiffEngine.generateJsonDiff(diff));
          } else {
            console.log(this.stateDiffEngine.generateHumanReadableDiff(diff));
          }

        } catch (error) {
          console.error(chalk.red('Error generating diff:'), error);
        }
      });

    return cmd;
  }

  createResetCommand(): Command {
    const cmd = new Command('reset');
    
    cmd
      .argument('[name]', 'Snapshot name to reset to (default: default)')
      .action(async (name = 'default') => {
        try {
          const snapshot = await this.snapshotManager.resetToSnapshot(name);
          console.log(chalk.green(`Reset to snapshot '${name}'`));
          console.log(`Timestamp: ${snapshot.timestamp}`);
          console.log(`Tables: ${Object.keys(snapshot.tables).length}`);
        } catch (error) {
          console.error(chalk.red('Error resetting:'), error);
        }
      });

    return cmd;
  }

  createTestCommand(): Command {
    const cmd = new Command('test');
    
    cmd
      .argument('[testFile]', 'Test file to run (optional)')
      .option('-v, --verbose', 'Verbose output')
      .action(async (testFile, options) => {
        try {
          const results = await this.testFramework.runTests(testFile, options.verbose);
          
          console.log(chalk.blue(`\nTest Results: ${results.passed}/${results.total} passed`));
          
          if (results.failed.length > 0) {
            console.log(chalk.red('\nFailed Tests:'));
            results.failed.forEach((test: any) => {
              console.log(`  ❌ ${test.name}: ${test.error}`);
            });
          }
          
          if (results.passed > 0) {
            console.log(chalk.green('\nPassed Tests:'));
            results.passedTests.forEach((test: any) => {
              console.log(`  ✅ ${test.name}`);
            });
          }

        } catch (error) {
          console.error(chalk.red('Error running tests:'), error);
        }
      });

    return cmd;
  }

  createLogsCommand(): Command {
    const cmd = new Command('logs');
    
    cmd
      .command('list')
      .description('List execution logs')
      .option('-d, --date <date>', 'Filter by date (YYYY-MM-DD)')
      .option('-f, --function <name>', 'Filter by function name')
      .action(async (options) => {
        try {
          let logs;
          if (options.function) {
            logs = await this.executionLogger.getLogsByFunction(options.function);
          } else {
            logs = await this.executionLogger.getLogs(options.date);
          }
          
          if (logs.length === 0) {
            console.log(chalk.yellow('No logs found.'));
            return;
          }
          
          console.log(chalk.green(`Found ${logs.length} logs:`));
          logs.forEach(log => {
            const status = log.error ? chalk.red('❌') : chalk.green('✅');
            console.log(`  ${status} ${log.timestamp} - ${log.functionName} (${log.executionTime}ms)`);
          });

        } catch (error) {
          console.error(chalk.red('Error listing logs:'), error);
        }
      });

    cmd
      .command('show <id>')
      .description('Show detailed log information')
      .action(async (id) => {
        try {
          const log = await this.executionLogger.getLogById(id);
          if (!log) {
            console.log(chalk.yellow(`Log with ID '${id}' not found.`));
            return;
          }
          
          console.log(this.executionLogger.generateHumanReadableLog(log));

        } catch (error) {
          console.error(chalk.red('Error showing log:'), error);
        }
      });

    cmd
      .command('export <path>')
      .description('Export logs to file')
      .option('-f, --format <format>', 'Export format (json|csv)', 'json')
      .option('-d, --date <date>', 'Filter by date (YYYY-MM-DD)')
      .action(async (path, options) => {
        try {
          await this.executionLogger.exportLogs(options.format as 'json' | 'csv', path, options.date);
          console.log(chalk.green(`Logs exported to ${path}`));
        } catch (error) {
          console.error(chalk.red('Error exporting logs:'), error);
        }
      });

    cmd
      .command('clear')
      .description('Clear all logs')
      .action(async () => {
        try {
          await this.executionLogger.clearLogs();
          console.log(chalk.green('All logs cleared.'));
        } catch (error) {
          console.error(chalk.red('Error clearing logs:'), error);
        }
      });

    return cmd;
  }
}
