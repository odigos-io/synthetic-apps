FROM node:22.17.0-alpine
WORKDIR /app
COPY gateway/package.json .
RUN npm install --omit=dev
COPY gateway/src ./src
COPY proto ./src/proto
EXPOSE 8080
CMD ["node", "src/index.js"]
