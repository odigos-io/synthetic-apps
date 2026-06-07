package health

import (
	"encoding/json"
	"net/http"
	"sync"
)

type State struct {
	mu             sync.RWMutex
	ready          bool
	lastError      string
	lastProducedAt string
	lastConsumedAt string
	extra          map[string]any
}

func New() *State {
	return &State{extra: make(map[string]any)}
}

func (s *State) SetReady(ready bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ready = ready
}

func (s *State) SetError(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err == nil {
		s.lastError = ""
		return
	}
	s.lastError = err.Error()
}

func (s *State) SetProducedAt(ts string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastProducedAt = ts
}

func (s *State) SetConsumedAt(ts string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastConsumedAt = ts
}

func (s *State) SetExtra(key string, value any) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.extra[key] = value
}

func (s *State) Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		defer s.mu.RUnlock()

		body := map[string]any{
			"ready": s.ready,
		}
		for k, v := range s.extra {
			body[k] = v
		}
		if s.lastError != "" {
			body["error"] = s.lastError
		}
		if s.lastProducedAt != "" {
			body["lastProducedAt"] = s.lastProducedAt
		}
		if s.lastConsumedAt != "" {
			body["lastConsumedAt"] = s.lastConsumedAt
		}

		status := http.StatusOK
		if !s.ready || s.lastError != "" {
			status = http.StatusServiceUnavailable
			body["status"] = "not ready"
		} else {
			body["status"] = "ok"
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(body)
	}
}

func (s *State) ServeMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.Handler())
	return mux
}

func (s *State) ListenAndServe(addr string) error {
	return http.ListenAndServe(addr, s.ServeMux())
}

func (s *State) ListenAndServeMux(addr string, mux *http.ServeMux) error {
	return http.ListenAndServe(addr, mux)
}
