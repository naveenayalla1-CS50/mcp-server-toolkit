# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages packages/
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Build all packages
RUN npm run build

# Runtime stage
FROM node:18-alpine

WORKDIR /app

# Copy package files from builder
COPY package*.json ./
COPY packages packages/

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/packages packages/

# Expose default MCP server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Start the MCP server
# This will run the main toolkit entry point
CMD ["node", "packages/core/build/index.js"]
