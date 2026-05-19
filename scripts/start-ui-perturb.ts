#!/usr/bin/env node

import { TwinUIServer } from '../src/ui/ui-server';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string, fallback?: string) => {
    const idx = args.indexOf(`--${name}`);
    if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
    return fallback;
  };

  const has = (name: string) => args.includes(`--${name}`) || args.includes(`-${name[0]}`);

  return {
    port: Number(get('port', '3000')),
    host: get('host', '0.0.0.0'),
    snapshot: get('snapshot', 'default'),
    delayedWrites: has('delayedWrites'),
    staleReads: has('staleReads'),
    concurrentMutations: has('concurrentMutations'),
    artificialLatencyMs: Number(get('latency', '0')),
    snapshotsDir: process.env.SNAPSHOTS_DIR || get('snapshotsDir', './snapshots'),
    logsDir: process.env.LOGS_DIR || get('logsDir', './logs')
  };
}

async function main() {
  const opts = parseArgs();

  const server = new TwinUIServer({
    port: opts.port,
    host: opts.host,
    snapshotName: opts.snapshot,
    snapshotsDir: opts.snapshotsDir,
    logsDir: opts.logsDir,
    perturbations: {
      delayedWrites: opts.delayedWrites,
      staleReads: opts.staleReads,
      concurrentMutations: opts.concurrentMutations,
      artificialLatencyMs: opts.artificialLatencyMs
    }
  });

  try {
    const address = await server.start();
    console.log(`UI started at http://${address.host}:${address.port} (snapshot: ${address.snapshotName})`);
    console.log('Perturbations: ', {
      delayedWrites: opts.delayedWrites,
      staleReads: opts.staleReads,
      concurrentMutations: opts.concurrentMutations,
      artificialLatencyMs: opts.artificialLatencyMs
    });

    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await server.stop();
      process.exit(0);
    });
  } catch (err) {
    console.error('Failed to start UI server:', err);
    process.exit(1);
  }
}

main();
