#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { CLICommands } from './commands';

const program = new Command();
const commands = new CLICommands();

program
  .name('twin')
  .description('Convex Twin - Local deterministic replay and testing environment for Convex backends')
  .version('1.0.0');

program.addCommand(commands.createSnapshotCommand());
program.addCommand(commands.createRunCommand());
program.addCommand(commands.createDiffCommand());
program.addCommand(commands.createResetCommand());
program.addCommand(commands.createTestCommand());
program.addCommand(commands.createLogsCommand());

program
  .command('init')
  .description('Initialize a new Convex Twin project')
  .option('-d, --dir <directory>', 'Directory to initialize', '.')
  .action(async (options) => {
    try {
      const projectDir = path.resolve(options.dir);
      
      await fs.ensureDir(projectDir);
      await fs.ensureDir(path.join(projectDir, 'snapshots'));
      await fs.ensureDir(path.join(projectDir, 'logs'));
      await fs.ensureDir(path.join(projectDir, 'tests'));
      await fs.ensureDir(path.join(projectDir, 'functions'));
      
      const exampleSnapshot = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        tables: {
          users: [
            {
              _id: 'user_123',
              _creationTime: Date.now(),
              name: 'John Doe',
              email: 'john@example.com'
            }
          ],
          messages: [
            {
              _id: 'msg_456',
              _creationTime: Date.now(),
              userId: 'user_123',
              text: 'Hello, world!',
              channel: 'general'
            }
          ]
        }
      };
      
      await fs.writeJSON(
        path.join(projectDir, 'snapshots', 'default.json'),
        exampleSnapshot,
        { spaces: 2 }
      );
      
      const exampleTest = {
        id: 'example-test',
        name: 'Example Test',
        description: 'An example test case',
        initialSnapshot: 'default',
        functionName: 'listUsers',
        functionType: 'query',
        args: {},
        expectedOutput: { count: 1 },
        shouldPass: true
      };
      
      await fs.writeJSON(
        path.join(projectDir, 'tests', 'example.json'),
        exampleTest,
        { spaces: 2 }
      );
      
      console.log(chalk.green(`✅ Convex Twin project initialized in ${projectDir}`));
      console.log(chalk.blue('Created directories:'));
      console.log('  - snapshots/ (for database snapshots)');
      console.log('  - logs/ (for execution logs)');
      console.log('  - tests/ (for test cases)');
      console.log('  - functions/ (for your Convex functions)');
      console.log(chalk.blue('\nExample files created:'));
      console.log('  - snapshots/default.json (example snapshot)');
      console.log('  - tests/example.json (example test)');
      
    } catch (error) {
      console.error(chalk.red('Error initializing project:'), error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show project status')
  .action(async () => {
    try {
      
      const dirs = ['snapshots', 'logs', 'tests', 'functions'];
      const existingDirs = [];
      const missingDirs = [];
      
      for (const dir of dirs) {
        if (await fs.pathExists(dir)) {
          existingDirs.push(dir);
        } else {
          missingDirs.push(dir);
        }
      }
      
      console.log(chalk.blue('📊 Project Status'));
      console.log('');
      
      if (existingDirs.length > 0) {
        console.log(chalk.green('✅ Existing directories:'));
        existingDirs.forEach(dir => console.log(`  - ${dir}/`));
      }
      
      if (missingDirs.length > 0) {
        console.log(chalk.yellow('⚠️  Missing directories:'));
        missingDirs.forEach(dir => console.log(`  - ${dir}/`));
        console.log('');
        console.log(chalk.blue('Run "twin init" to create the missing directories.'));
      }
      
      if (await fs.pathExists('snapshots')) {
        const snapshots = await fs.readdir('snapshots');
        console.log(chalk.blue(`\n📸 Snapshots: ${snapshots.length}`));
        snapshots.forEach(snapshot => console.log(`  - ${snapshot}`));
      }
      
      if (await fs.pathExists('logs')) {
        const logs = await fs.readdir('logs');
        console.log(chalk.blue(`\n📋 Log files: ${logs.length}`));
        logs.forEach(log => console.log(`  - ${log}`));
      }
      
      if (await fs.pathExists('tests')) {
        const tests = await fs.readdir('tests');
        console.log(chalk.blue(`\n🧪 Test files: ${tests.length}`));
        tests.forEach(test => console.log(`  - ${test}`));
      }
      
    } catch (error) {
      console.error(chalk.red('Error checking status:'), error);
    }
  });

if (process.argv.length === 2) {
  program.outputHelp();
}

program.parse();
