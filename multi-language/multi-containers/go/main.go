package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "9090"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":   "healthy",
			"language": "go",
		})
	})

	addr := "0.0.0.0:" + port
	log.Printf("multi-containers go listening on http://%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
