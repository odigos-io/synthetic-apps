FROM node:22.17.0-alpine
WORKDIR /app

COPY ./package.json /app
COPY ./yarn.lock /app
RUN yarn install

COPY ./src /app/src
CMD ["node", "src/index.js"]

