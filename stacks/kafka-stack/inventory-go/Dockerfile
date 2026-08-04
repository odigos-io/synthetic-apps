FROM golang:1.23.11-alpine AS builder
RUN apk add --no-cache protobuf-dev
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.35.2
RUN go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.5.1
WORKDIR /app
COPY kafka-stack/inventory-go/go.mod kafka-stack/inventory-go/go.sum* ./
RUN go mod download
COPY proto/lookup.proto ./proto/
RUN sed -i 's|option go_package = ".*"|option go_package = "inventory-go/pb";|' proto/lookup.proto
RUN protoc --go_out=. --go_opt=module=inventory-go \
    --go-grpc_out=. --go-grpc_opt=module=inventory-go \
    proto/lookup.proto
COPY kafka-stack/inventory-go/src ./src/
RUN CGO_ENABLED=0 go build -o main ./src/

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080 50051
CMD ["./main"]
