FROM node:18-alpine

WORKDIR /app

COPY . .

# Install with legacy peer deps to resolve eslint/typescript-eslint conflicts
RUN npm install --legacy-peer-deps

# Build if build script exists
RUN npm run build 2>/dev/null || echo "No build script found"

EXPOSE 3000

CMD ["npm", "start"]
