package main

import (
	"context"
	"encoding/json"
	"log"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/segmentio/kafka-go"
	"golang-kafka/internal/config"
	"golang-kafka/internal/health"
)

func main() {
	cfg := config.CommonFromEnv()
	healthState := health.New()
	healthState.SetExtra("role", "producer")
	healthState.SetExtra("brokers", cfg.Brokers)
	healthState.SetExtra("topics", cfg.Topics)

	go func() {
		addr := ":" + cfg.Port
		log.Printf("producer health listening on %s", addr)
		if err := healthState.ListenAndServe(addr); err != nil {
			log.Fatalf("health server: %v", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	time.Sleep(config.StartupDelay())

	writers := make(map[string]*kafka.Writer, len(cfg.Topics))
	for _, topic := range cfg.Topics {
		writers[topic] = &kafka.Writer{
			Addr:         kafka.TCP(cfg.Brokers...),
			Topic:        topic,
			Balancer:     &kafka.LeastBytes{},
			RequiredAcks: kafka.RequireOne,
			Async:        false,
		}
	}
	defer func() {
		for _, w := range writers {
			_ = w.Close()
		}
	}()

	var topicIndex atomic.Uint64
	sendOnce := func() {
		if len(cfg.Topics) == 0 {
			return
		}
		idx := topicIndex.Add(1) - 1
		topic := cfg.Topics[idx%uint64(len(cfg.Topics))]
		writer := writers[topic]

		payload, _ := json.Marshal(map[string]any{
			"ts":    time.Now().UTC().Format(time.RFC3339Nano),
			"topic": topic,
			"role":  "producer",
		})
		err := writer.WriteMessages(ctx, kafka.Message{
			Key:   []byte(topic),
			Value: payload,
		})
		if err != nil {
			healthState.SetError(err)
			log.Printf("produce error topic=%s: %v", topic, err)
			return
		}
		healthState.SetError(nil)
		healthState.SetProducedAt(time.Now().UTC().Format(time.RFC3339Nano))
		log.Printf("produced topic=%s bytes=%d", topic, len(payload))
	}

	sendOnce()
	healthState.SetReady(true)

	ticker := time.NewTicker(config.ProduceInterval())
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("shutting down producer")
			return
		case <-ticker.C:
			sendOnce()
		}
	}
}
