package memory

// Store holds synthetic values in process memory.
type Store struct {
	data map[string]string
}

// NewStore creates a store pre-populated with deterministic test values.
func NewStore() *Store {
	return &Store{
		data: map[string]string{
			"greeting": "hello from memory",
			"version":  "1.0.0",
			"token":    "synthetic-memory-token",
		},
	}
}

// FetchValue returns the in-memory value for key.
func (s *Store) FetchValue(key string) (string, bool) {
	value, ok := s.data[key]
	return value, ok
}
