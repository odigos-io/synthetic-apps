# There seems to be a bug in 1.17.0 that prevents odigos from detecting the correct version.
# This is fixed in 1.17.1, so it is used as the minimum version instead.
FROM golang:1.17.1-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY src/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
CMD ["./main"] 