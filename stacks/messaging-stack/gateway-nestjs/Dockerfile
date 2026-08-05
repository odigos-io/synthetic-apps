FROM node:22.17.0-alpine AS builder
WORKDIR /app
COPY messaging-stack/gateway-nestjs/package.json messaging-stack/gateway-nestjs/tsconfig.json ./
RUN npm install
COPY messaging-stack/gateway-nestjs/src ./src
RUN npm run build

FROM node:22.17.0-alpine
WORKDIR /app
COPY messaging-stack/gateway-nestjs/package.json .
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/main.js"]
