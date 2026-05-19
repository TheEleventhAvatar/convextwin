FROM node:20-bullseye-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY tsconfig.json ./
RUN npm ci --only=production || npm install --no-audit --no-fund

# Copy source
COPY . .

# Expose UI port
EXPOSE 3000

# Start the UI using the helper (ts-node will be available via devDependency fallback)
CMD ["npx", "ts-node", "scripts/start-ui-perturb.ts", "--port", "3000"]
