FROM node:20.17.0-alpine
WORKDIR /app
COPY ./package.json /app
COPY ./yarn.lock /app
RUN yarn install
COPY ./src /app
# We add 2 environment variables to the Dockerfile and the application will fail if they were not applied:
# --require to make sure a script we set up to run before the main application is executed
# --max-old-space-size=256 to make sure the application specific requests are preserved
ENV NODE_OPTIONS="--require /app/execute_before.js --max-old-space-size=256"
ENV CHECK_FOR_APP_REQUIRE="true"
ENV CHECK_FOR_HEAP_SIZE="true"
CMD ["node", "index.js"]
