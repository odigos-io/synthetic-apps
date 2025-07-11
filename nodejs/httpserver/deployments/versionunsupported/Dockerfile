FROM node:8.17.0-alpine
WORKDIR /app
COPY ./package.json /app
COPY ./yarn.lock /app
RUN yarn install
COPY ./src /app
CMD ["node", "index.js"]

