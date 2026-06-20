FROM node:current-alpine
WORKDIR /app
COPY ./package.json /app
COPY ./yarn.lock /app
RUN npm install -g yarn && yarn install
COPY ./src /app
CMD ["node", "index.js"]
