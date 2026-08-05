FROM golang:1.23.11-alpine AS builder
WORKDIR /app
COPY search-stack/go-indexer/go.mod search-stack/go-indexer/go.sum* ./
RUN go mod download
COPY search-stack/go-indexer/src ./src/
RUN CGO_ENABLED=0 go build -o main ./src/

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
