# Deploying Convex Twin UI (quick)

This document shows a minimal Docker-based deployment for the Convex Twin reliability sandbox.

Build and run with Docker Compose:

```bash
# Build the image
docker compose build

# Run in foreground (maps port 3000)
docker compose up

# Run in background
docker compose up -d
```

Notes:
- The container starts the UI via `scripts/start-ui-perturb.ts`. By default it launches on port 3000.
- To enable perturbations, modify the `CMD` in the `Dockerfile` or run the container with a custom command, for example:

```bash
docker run --rm -p 3000:3000 convex-twin:latest \
  npx ts-node scripts/start-ui-perturb.ts --delayedWrites --staleReads --concurrentMutations --latency 1200
```

- The `snapshots/` and `logs/` directories are mounted so state and event logs survive container restarts.
- This is a simple development-level deployment. For production, build the TypeScript and run the compiled JS, add process supervision, and secure the host network.

Persistent disk on Render
-------------------------

To persist `snapshots/` and `logs/` across deploys, create a Render managed disk and mount it at `/data` for the service, then set the environment variables so the app uses the mounted path.

Steps (Render dashboard):

1. In Render, open your service and go to the "Disks" tab. Create a new managed disk (e.g. `convex-twin-disk`) and choose a size (e.g. 10 GB).
2. Attach the disk to the service and set the mount path to `/data`.
3. In the service environment variables, add:

  - `SNAPSHOTS_DIR` = `/data/snapshots`
  - `LOGS_DIR` = `/data/logs`

4. Redeploy the service. The helper script uses these env vars to set the `snapshots` and `logs` directories inside the container.

Example `render.yaml` uses `/data/snapshots` and `/data/logs` as the defaults; if you use a different mount path, set the env vars accordingly.

