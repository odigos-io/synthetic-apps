FROM golang:1.23.11-alpine AS builder
WORKDIR /app
COPY messaging-stack/gin-recommendations/go.mod messaging-stack/gin-recommendations/go.sum* ./
RUN go mod download
COPY messaging-stack/gin-recommendations/src ./src/
RUN CGO_ENABLED=0 go build -o main ./src/

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
