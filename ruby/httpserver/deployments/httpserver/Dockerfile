# Debian based images are used for all Ruby variants instead of alpine, because the Odigos Ruby
# agent ships a single gem bundle with no musl build.
FROM ruby:3.4-slim
WORKDIR /app
COPY ./src /app
EXPOSE 8080
CMD ["ruby", "main.rb"]
