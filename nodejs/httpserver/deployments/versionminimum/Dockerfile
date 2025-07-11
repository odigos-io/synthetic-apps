FROM node:14.0.0-alpine
WORKDIR /app
COPY ./package.json /app
COPY ./yarn.lock /app
RUN yarn install
COPY ./src /app
CMD ["node", "index.js"]
