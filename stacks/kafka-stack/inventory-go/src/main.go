package main

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/segmentio/kafka-go"
	"google.golang.org/grpc"

	pb "inventory-go/pb"
)

var inventory sync.Map

type lookupServer struct {
	pb.UnimplementedLookupServiceServer
}

func (s *lookupServer) Get(_ context.Context, req *pb.LookupRequest) (*pb.LookupResponse, error) {
	key := req.GetKey()
	val, ok := inventory.Load(key)
	if !ok {
		val = "unknown"
	}
	log.Printf("grpc inventory key=%s", key)
	return &pb.LookupResponse{Key: key, Value: val.(string), Source: "kafka-grpc"}, nil
}

func main() {
	brokers := envOr("KAFKA_BROKERS", "kafka-broker:9092")
	topic := envOr("KAFKA_TOPIC", "stacks-events")
	groupID := envOr("KAFKA_GROUP_ID", "inventory-go")

	go consumeKafka(brokers, topic, groupID)

	srv := &lookupServer{}
	grpcServer := grpc.NewServer()
	pb.RegisterLookupServiceServer(grpcServer, srv)
	go func() {
		lis, _ := net.Listen("tcp", ":50051")
		log.Println("inventory-go gRPC :50051")
		grpcServer.Serve(lis)
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "stack": "kafka"})
	})
	mux.HandleFunc("/inventory/", func(w http.ResponseWriter, r *http.Request) {
		key := strings.TrimPrefix(r.URL.Path, "/inventory/")
		val, ok := inventory.Load(key)
		if !ok {
			val = "stock-" + key
			inventory.Store(key, val)
		}
		log.Printf("HTTP inventory key=%s", key)
		json.NewEncoder(w).Encode(map[string]string{"key": key, "value": val.(string)})
	})

	log.Println("inventory-go HTTP :8080")
	http.ListenAndServe(":8080", mux)
}

func consumeKafka(brokers, topic, groupID string) {
	time.Sleep(8 * time.Second)
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{brokers},
		Topic:   topic,
		GroupID: groupID + "-reader",
	})
	for {
		msg, err := r.ReadMessage(context.Background())
		if err != nil {
			log.Printf("kafka read: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}
		key := string(msg.Key)
		inventory.Store(key, "updated-"+key)
		log.Printf("kafka consumed key=%s", key)
	}
}

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
