FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY . .

# Install with legacy peer deps to resolve eslint/typescript-eslint conflicts
RUN npm install --legacy-peer-deps

# Build workspaces in correct order (core first, then code-search)
RUN npm run build -w @mcp-toolkit/core && \
    npm run build -w @mcp-toolkit/code-search

# Install mcp-proxy globally for Glama compatibility
RUN npm install -g mcp-proxy@6.4.3

EXPOSE 8080

CMD ["mcp-proxy", "--", "node", "packages/code-search/dist/index.js"]
