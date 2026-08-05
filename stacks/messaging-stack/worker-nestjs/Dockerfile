FROM node:22.17.0-alpine AS builder
WORKDIR /app
COPY messaging-stack/worker-nestjs/package.json messaging-stack/worker-nestjs/tsconfig.json ./
RUN npm install
COPY messaging-stack/worker-nestjs/src ./src
RUN npm run build

FROM node:22.17.0-alpine
WORKDIR /app
COPY messaging-stack/worker-nestjs/package.json .
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/main.js"]
