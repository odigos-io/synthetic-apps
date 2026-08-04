package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"

	pb "cache-go/pb"
)

type lookupServer struct {
	pb.UnimplementedLookupServiceServer
	rdb *redis.Client
}

func (s *lookupServer) Get(ctx context.Context, req *pb.LookupRequest) (*pb.LookupResponse, error) {
	key := req.GetKey()
	val, err := s.rdb.Get(ctx, "cache:"+key).Result()
	if err == redis.Nil {
		val = "miss"
	} else if err != nil {
		return nil, err
	}
	log.Printf("grpc Get key=%s value=%s", key, val)
	return &pb.LookupResponse{Key: key, Value: val, Source: "redis-grpc"}, nil
}

func main() {
	host := envOr("REDIS_HOST", "redis")
	port := envOr("REDIS_DB_PORT", "6379")
	notifierURL := envOr("NOTIFIER_URL", "http://notifier-java:8080")

	rdb := redis.NewClient(&redis.Options{Addr: host + ":" + port})
	for {
		if err := rdb.Ping(context.Background()).Err(); err == nil {
			break
		}
		log.Printf("waiting for redis...")
		time.Sleep(2 * time.Second)
	}

	srv := &lookupServer{rdb: rdb}
	grpcServer := grpc.NewServer()
	pb.RegisterLookupServiceServer(grpcServer, srv)

	go func() {
		lis, err := net.Listen("tcp", ":50051")
		if err != nil {
			log.Fatal(err)
		}
		log.Println("cache-go gRPC on :50051")
		grpcServer.Serve(lis)
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "stack": "redis"})
	})
	mux.HandleFunc("/cache/", func(w http.ResponseWriter, r *http.Request) {
		key := strings.TrimPrefix(r.URL.Path, "/cache/")
		if key == "" {
			http.Error(w, "key required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		switch r.Method {
		case http.MethodGet:
			val, err := rdb.Get(ctx, "cache:"+key).Result()
			if err == redis.Nil {
				val = "miss"
			} else if err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			log.Printf("HTTP GET cache key=%s", key)
			json.NewEncoder(w).Encode(map[string]string{"key": key, "value": val})
		case http.MethodPost:
			var body struct{ Value string `json:"value"` }
			json.NewDecoder(r.Body).Decode(&body)
			if body.Value == "" {
				body.Value = "cached-" + key
			}
			rdb.Set(ctx, "cache:"+key, body.Value, 5*time.Minute)
			rdb.Publish(ctx, "cache:events", fmt.Sprintf("%s=%s", key, body.Value))
			log.Printf("HTTP POST cache key=%s", key)
			http.Post(notifierURL+"/notify", "application/json",
				strings.NewReader(fmt.Sprintf(`{"key":"%s","value":"%s"}`, key, body.Value)))
			json.NewEncoder(w).Encode(map[string]string{"key": key, "value": body.Value})
		default:
			http.Error(w, "method not allowed", 405)
		}
	})

	log.Println("cache-go HTTP on :8080")
	http.ListenAndServe(":8080", mux)
}

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
