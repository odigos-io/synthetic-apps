package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
)

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

func main() {
	ctx := context.Background()
	db, err := waitDB(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	db.Exec(`
		CREATE TABLE IF NOT EXISTS audit_log (
			id SERIAL PRIMARY KEY,
			user_id TEXT,
			action TEXT,
			details JSONB,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)
	`)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "stack": "postgres"})
	})
	mux.HandleFunc("/audit", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", 405)
			return
		}
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		details, _ := json.Marshal(body)
		userId, _ := body["userId"].(string)
		action, _ := body["action"].(string)
		var id int
		err := db.QueryRowContext(r.Context(),
			"INSERT INTO audit_log (user_id, action, details) VALUES ($1, $2, $3) RETURNING id",
			userId, action, details).Scan(&id)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		log.Printf("audit id=%d user=%s action=%s", id, userId, action)
		json.NewEncoder(w).Encode(map[string]interface{}{"auditId": id, "recorded": true})
	})
	mux.HandleFunc("/audit/count", func(w http.ResponseWriter, r *http.Request) {
		var count int
		db.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM audit_log").Scan(&count)
		json.NewEncoder(w).Encode(map[string]int{"count": count})
	})

	log.Println("audit-go on :8080")
	http.ListenAndServe(":8080", mux)
}

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
