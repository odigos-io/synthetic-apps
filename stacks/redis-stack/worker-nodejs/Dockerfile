FROM node:22.17.0-alpine
WORKDIR /app
COPY redis-stack/worker-nodejs/package.json .
RUN npm install --omit=dev
COPY redis-stack/worker-nodejs/src ./src
EXPOSE 8080
CMD ["node", "src/index.js"]
