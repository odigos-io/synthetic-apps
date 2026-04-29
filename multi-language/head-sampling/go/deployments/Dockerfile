FROM golang:1.25-alpine AS build
WORKDIR /src
COPY ./go.mod /src
COPY ./main.go /src
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/app .

FROM alpine:3.20
WORKDIR /app
COPY --from=build /out/app /app/app
EXPOSE 9090
ENV PORT=9090
ENTRYPOINT ["/app/app"]

