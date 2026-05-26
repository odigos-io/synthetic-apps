FROM alpine:3.20 AS build
RUN apk add --no-cache g++
WORKDIR /src
COPY main.cpp .
RUN g++ -O2 -o server main.cpp

FROM alpine:3.20
RUN apk add --no-cache libstdc++ libgcc
WORKDIR /app
COPY --from=build /src/server /app/server
ENV PORT=8050
EXPOSE 8050
CMD ["/app/server"]
