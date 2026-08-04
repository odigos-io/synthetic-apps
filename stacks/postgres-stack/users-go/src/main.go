package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"google.golang.org/grpc"

	pb "users-go/pb"
)

type lookupServer struct {
	pb.UnimplementedLookupServiceServer
	db *sql.DB
}

func (s *lookupServer) Get(ctx context.Context, req *pb.LookupRequest) (*pb.LookupResponse, error) {
	var name, email string
	err := s.db.QueryRowContext(ctx, "SELECT name, email FROM users WHERE id = $1", req.GetKey()).Scan(&name, &email)
	if err == sql.ErrNoRows {
		return &pb.LookupResponse{Key: req.GetKey(), Value: "not-found", Source: "postgres-grpc"}, nil
	}
	if err != nil {
		return nil, err
	}
	return &pb.LookupResponse{Key: req.GetKey(), Value: name + " <" + email + ">", Source: "postgres-grpc"}, nil
}

func pgConn() string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		envOr("PGHOST", "postgres"), envOr("PGPORT", "5432"),
		envOr("PGUSER", "app"), envOr("PGPASSWORD", "app"), envOr("PGDATABASE", "stacks"))
}

func waitDB(ctx context.Context) (*sql.DB, error) {
	for {
		db, err := sql.Open("postgres", pgConn())
		if err != nil {
			time.Sleep(2 * time.Second)
			continue
		}
		if err := db.PingContext(ctx); err != nil {
			db.Close()
			time.Sleep(2 * time.Second)
			continue
		}
		return db, nil
	}
}

func initSchema(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT NOT NULL
		);
		INSERT INTO users (id, name, email) VALUES ('user-1', 'Alice', 'alice@example.com')
		ON CONFLICT (id) DO NOTHING;
	`)
	return err
}

func main() {
	ctx := context.Background()
	db, err := waitDB(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	initSchema(db)

	srv := &lookupServer{db: db}
	grpcServer := grpc.NewServer()
	pb.RegisterLookupServiceServer(grpcServer, srv)
	go func() {
		lis, _ := net.Listen("tcp", ":50051")
		log.Println("users-go gRPC :50051")
		grpcServer.Serve(lis)
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "stack": "postgres"})
	})
	mux.HandleFunc("/users/", func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/users/")
		var name, email string
		err := db.QueryRowContext(r.Context(), "SELECT name, email FROM users WHERE id = $1", id).Scan(&name, &email)
		if err == sql.ErrNoRows {
			http.Error(w, "not found", 404)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		log.Printf("GET user id=%s", id)
		json.NewEncoder(w).Encode(map[string]string{"id": id, "name": name, "email": email})
	})

	log.Println("users-go HTTP :8080")
	http.ListenAndServe(":8080", mux)
}

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
