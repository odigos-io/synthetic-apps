package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

const (
	port             = "8080"
	startupDelayMS   = 10000
	readyDelayMS     = 12000
	shutdownTimeout  = 10 * time.Second
)

var startTime = time.Now()

func simulateStartupDelay() bool {
	return strings.EqualFold(os.Getenv("SIMULATE_STARTUP_DELAY"), "true")
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func healthStartup(w http.ResponseWriter, r *http.Request) {
	if !simulateStartupDelay() {
		writeJSON(w, http.StatusOK, map[string]any{"status": "started", "simulated": false})
		return
	}
	elapsed := time.Since(startTime).Milliseconds()
	if elapsed >= startupDelayMS {
		writeJSON(w, http.StatusOK, map[string]any{"status": "started", "elapsed_ms": elapsed})
		return
	}
	writeJSON(w, http.StatusServiceUnavailable, map[string]any{
		"status":        "starting",
		"remaining_ms": startupDelayMS - elapsed,
	})
}

func healthReady(w http.ResponseWriter, r *http.Request) {
	if !simulateStartupDelay() {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ready", "simulated": false})
		return
	}
	elapsed := time.Since(startTime).Milliseconds()
	if elapsed >= readyDelayMS {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ready", "elapsed_ms": elapsed})
		return
	}
	writeJSON(w, http.StatusServiceUnavailable, map[string]any{
		"status":        "not_ready",
		"remaining_ms": readyDelayMS - elapsed,
	})
}

func healthLive(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "alive"})
}

func healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "healthy"})
}

func samplingHandler(endpoint, description string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"endpoint": endpoint, "description": description})
	}
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz/startup", healthStartup)
	mux.HandleFunc("/healthz/ready", healthReady)
	mux.HandleFunc("/healthz/live", healthLive)
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/sampling/percentage/no-rule", samplingHandler(
		"/sampling/percentage/no-rule", "no sampling rule matches this endpoint"))
	mux.HandleFunc("/sampling/percentage/sampled-0", samplingHandler(
		"/sampling/percentage/sampled-0", "sampling rule with 0% rate"))
	mux.HandleFunc("/sampling/percentage/sampled-50", samplingHandler(
		"/sampling/percentage/sampled-50", "sampling rule with 50% rate"))
	mux.HandleFunc("/sampling/percentage/sampled-100", samplingHandler(
		"/sampling/percentage/sampled-100", "sampling rule with 100% rate"))
	mux.HandleFunc("/sampling/percentage/sampled-fallback", samplingHandler(
		"/sampling/percentage/sampled-fallback", "sampling rule with no percentage, falls back to 0%"))

	server := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	go func() {
		log.Printf("head-sampling server running at http://127.0.0.1:%s/", port)
		if simulateStartupDelay() {
			log.Printf("Startup probe will pass after %ds", startupDelayMS/1000)
			log.Printf("Readiness probe will pass after %ds", readyDelayMS/1000)
		} else {
			log.Println("Startup delay simulation is disabled")
		}
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit

	log.Println("SIGTERM received, shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("server shutdown: %v", err)
		os.Exit(1)
	}
	log.Println("HTTP server closed")
}
