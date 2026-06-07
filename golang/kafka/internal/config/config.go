package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	DefaultPort              = "8080"
	DefaultBrokers           = "kafka-broker:9092"
	DefaultTopics            = "synthetic-kafka-a,synthetic-kafka-b,synthetic-kafka-c"
	DefaultProduceInterval   = 5 * time.Second
	DefaultStartupDelay      = 3 * time.Second
	DefaultProcessDelay      = 25 * time.Millisecond
	DefaultConsumerGroup     = "golang-kafka-group"
	DefaultProducerClientID  = "golang-kafka-producer"
	DefaultConsumerClientID         = "golang-kafka-consumer"
	DefaultProcessContinuationPath = "/kafka/process"
)

type Common struct {
	Port    string
	Brokers []string
	Topics  []string
}

func CommonFromEnv() Common {
	return Common{
		Port:    envOr("PORT", DefaultPort),
		Brokers: splitCSV(envOr("KAFKA_BROKERS", DefaultBrokers)),
		Topics:  splitCSV(envOr("KAFKA_TOPICS", DefaultTopics)),
	}
}

func StartupDelay() time.Duration {
	return durationFromMS("STARTUP_DELAY_MS", DefaultStartupDelay)
}

func ProduceInterval() time.Duration {
	return durationFromMS("PRODUCE_INTERVAL_MS", DefaultProduceInterval)
}

func ProcessDelay() time.Duration {
	return durationFromMS("PROCESS_DELAY_MS", DefaultProcessDelay)
}

func ProducerClientID() string {
	return envOr("KAFKA_CLIENT_ID", DefaultProducerClientID)
}

func ConsumerGroupID() string {
	return envOr("KAFKA_GROUP_ID", DefaultConsumerGroup)
}

func ConsumerClientID() string {
	return envOr("KAFKA_CLIENT_ID", DefaultConsumerClientID)
}

func ConsumerSelfBaseURL(port string) string {
	if v := strings.TrimSpace(os.Getenv("CONSUMER_SELF_BASE_URL")); v != "" {
		return v
	}
	return fmt.Sprintf("http://127.0.0.1:%s", port)
}

func ProcessContinuationPath() string {
	return envOr("PROCESS_CONTINUATION_PATH", DefaultProcessContinuationPath)
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func splitCSV(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func durationFromMS(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	ms, err := strconv.Atoi(raw)
	if err != nil || ms < 0 {
		return fallback
	}
	return time.Duration(ms) * time.Millisecond
}
