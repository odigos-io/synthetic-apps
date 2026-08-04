FROM node:22.17.0-alpine
WORKDIR /app
COPY kafka-stack/relay-nodejs/package.json .
RUN npm install --omit=dev
COPY kafka-stack/relay-nodejs/src ./src
EXPOSE 8080
CMD ["node", "src/index.js"]
