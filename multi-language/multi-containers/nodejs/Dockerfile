FROM node:22.17.0-alpine
WORKDIR /app
COPY ./package.json /app
COPY ./yarn.lock /app
RUN yarn install --production
COPY ./src /app
ENV PORT=8080
EXPOSE 8080
CMD ["node", "index.js"]
