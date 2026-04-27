FROM node:22.17.0-alpine
WORKDIR /app
COPY ./package.json /app
RUN yarn install --production --no-lockfile
COPY ./src /app
CMD ["node", "index.js"]
