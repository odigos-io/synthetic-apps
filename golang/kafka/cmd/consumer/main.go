package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/segmentio/kafka-go"

	"golang-kafka/internal/config"
	"golang-kafka/internal/health"
)

func main() {
	cfg := config.CommonFromEnv()
	groupID := config.ConsumerGroupID()
	healthState := health.New()
	healthState.SetExtra("role", "consumer")
	healthState.SetExtra("brokers", cfg.Brokers)
	healthState.SetExtra("topics", cfg.Topics)
	healthState.SetExtra("groupId", groupID)

	mux := healthState.ServeMux()
	mux.HandleFunc(config.ProcessContinuationPath(), processContinuationHandler)

	go func() {
		addr := ":" + cfg.Port
		log.Printf("consumer http listening on %s (healthz, %s)", addr, config.ProcessContinuationPath())
		if err := healthState.ListenAndServeMux(addr, mux); err != nil {
			log.Fatalf("http server: %v", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	time.Sleep(config.StartupDelay())

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     cfg.Brokers,
		GroupID:     groupID,
		GroupTopics: cfg.Topics,
		MinBytes:    1,
		MaxBytes:    10e6,
		StartOffset: kafka.LastOffset,
	})
	defer func() {
		_ = reader.Close()
	}()

	healthState.SetReady(true)

	for {
		if ctx.Err() != nil {
			log.Println("shutting down consumer")
			return
		}

		fetchCtx, cancelFetch := context.WithTimeout(ctx, 10*time.Second)
		msg, err := reader.FetchMessage(fetchCtx)
		cancelFetch()
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			if err == context.DeadlineExceeded {
				continue
			}
			healthState.SetError(err)
			log.Printf("fetch error: %v", err)
			time.Sleep(time.Second)
			continue
		}

		if err := processMessage(ctx, msg, cfg.Port); err != nil {
			healthState.SetError(err)
			log.Printf("process error topic=%s offset=%d: %v", msg.Topic, msg.Offset, err)
			continue
		}

		if err := reader.CommitMessages(ctx, msg); err != nil {
			healthState.SetError(err)
			log.Printf("commit error topic=%s offset=%d: %v", msg.Topic, msg.Offset, err)
			continue
		}

		healthState.SetError(nil)
		healthState.SetConsumedAt(time.Now().UTC().Format(time.RFC3339Nano))
		log.Printf(
			"consumed and committed topic=%s partition=%d offset=%d key=%s value=%s",
			msg.Topic, msg.Partition, msg.Offset, string(msg.Key), string(msg.Value),
		)
	}
}

func processContinuationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"endpoint": config.ProcessContinuationPath(),
		"status":   "ok",
	})
}

func processMessage(ctx context.Context, msg kafka.Message, port string) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(config.ProcessDelay()):
	}

	return callProcessContinuation(ctx, config.ConsumerSelfBaseURL(port), config.ProcessContinuationPath())
}

func callProcessContinuation(ctx context.Context, baseURL, path string) error {
	url := strings.TrimRight(baseURL, "/") + path
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("process continuation %s: status %d", url, resp.StatusCode)
	}
	return nil
}
