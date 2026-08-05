FROM node:22.17.0-alpine
WORKDIR /app
COPY search-stack/nodejs-cache/package.json .
RUN npm install --omit=dev
COPY search-stack/nodejs-cache/src ./src
EXPOSE 8080
CMD ["node", "src/index.js"]
