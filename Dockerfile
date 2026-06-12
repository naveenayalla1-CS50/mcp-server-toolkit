FROM node:18-alpine

WORKDIR /app

COPY . .

RUN npm install

RUN npm run build 2>/dev/null || echo "No build script found"

EXPOSE 3000

CMD ["npm", "start"]
