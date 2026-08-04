FROM node:22.17.0-alpine
WORKDIR /app
COPY kafka-stack/gateway-nodejs/package.json .
RUN npm install --omit=dev
COPY kafka-stack/gateway-nodejs/src ./src
COPY proto ./proto
EXPOSE 8080
CMD ["node", "src/index.js"]
