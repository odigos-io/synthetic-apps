package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

const (
	listenAddr = ":8080"
	plainQuery = "SELECT id, name, email FROM users WHERE name = 'alice'"
	// Traces capture at most ~250 query chars; align a cut mid-word at 256.
	queryCaptureTruncateAt = 256
	// Postgres unquoted identifiers are capped at 63 bytes.
	maxIdentLen = 63

	// Distinctive but realistic AS aliases used to identify each truncate query in tests.
	markerTruncateWhere = "status_filter_display_name"
	markerTruncateFrom  = "shipment_source_lookup_key"
	markerTruncateTable = "inventory_catalog_source_key"
)

// Long SELECT lists (realistic id/name/email AS …) pad so a 256-char capture cuts mid-word.
// After the cut point the SQL is short and realistic (no artificial tail padding).
var (
	queryTruncateWhere = buildQueryCuttingWord(
		"WHERE", " FROM users ", " name = 'alice'", markerTruncateWhere,
	)
	queryTruncateFrom = buildQueryCuttingWord(
		"FROM", " ", " users WHERE name = 'alice'", markerTruncateFrom,
	)
	queryTruncateTable = buildQueryCuttingWord(
		"users", " FROM ", " WHERE name = 'alice'", markerTruncateTable,
	)
)

// Realistic projected columns used to lengthen the SELECT list.
var selectProjections = []struct{ expr, alias string }{
	{"id", "user_primary_key"},
	{"name", "display_full_name"},
	{"email", "primary_email_address"},
	{"id", "account_owner_user_id"},
	{"name", "preferred_display_name"},
	{"email", "notification_email_address"},
	{"id", "billing_customer_reference_id"},
	{"name", "legal_registered_full_name"},
	{"email", "account_recovery_email"},
	{"id", "organization_membership_id"},
	{"name", "public_profile_display_name"},
	{"email", "workplace_contact_email"},
	{"id", "external_system_reference_id"},
	{"name", "normalized_search_full_name"},
	{"email", "secondary_contact_email"},
	{"id", "legacy_imported_user_id"},
	{"name", "localized_display_full_name"},
	{"email", "marketing_contact_email"},
	{"id", "support_ticket_requester_id"},
	{"name", "directory_listed_full_name"},
	{"email", "billing_invoice_email"},
}

// Exact-length aliases so SELECT list padding never needs "xxx" filler.
var aliasExactFragments = []string{
	"n", "id", "key", "code", "email", "status", "user_id", "account",
	"customer", "billing_id", "account_key", "customer_id", "shipping_code",
	"profile_status", "contact_user_id", "primary_account", "billing_customer",
	"shipping_account", "profile_reference", "customer_account_id",
	"billing_account_key", "shipping_customer_id", "profile_contact_email",
	"customer_billing_status", "account_shipping_code_id",
	"customer_account_billing_id", "primary_customer_account_key",
	"billing_shipping_profile_code", "customer_account_contact_email",
	"primary_billing_customer_status", "account_shipping_profile_user_id",
	"customer_billing_shipping_account", "primary_account_contact_reference",
	"billing_customer_shipping_profile", "customer_account_billing_shipping",
	"primary_customer_billing_account_id",
	"account_shipping_profile_contact_key",
	"customer_billing_shipping_profile_id",
	"primary_account_customer_billing_code",
	"shipping_profile_contact_reference_id",
	"customer_account_billing_shipping_key",
	"primary_billing_customer_account_status",
	"account_shipping_profile_contact_user_id",
	"customer_billing_shipping_profile_code_id",
	"primary_account_customer_billing_ship_key",
	"shipping_profile_contact_reference_status",
	"customer_account_billing_shipping_profile",
	"primary_billing_customer_account_ship_code",
	"account_shipping_profile_contact_user_key",
	"customer_billing_shipping_profile_status_id",
	"primary_account_customer_billing_ship_email",
	"shipping_profile_contact_reference_user_key",
	"customer_account_billing_shipping_profile_id",
	"primary_billing_customer_account_ship_status",
	"account_shipping_profile_contact_user_email",
	"customer_billing_shipping_profile_status_key",
	"primary_account_customer_billing_ship_code_id",
	"shipping_profile_contact_reference_user_status",
	"customer_account_billing_shipping_profile_code",
	"primary_billing_customer_account_shipping_key",
	"account_shipping_profile_contact_user_ref_id",
	"customer_billing_shipping_profile_status_email",
	"primary_account_customer_billing_shipping_code",
}

func init() {
	for _, frag := range aliasExactFragments {
		if len(frag) > maxIdentLen {
			panic(fmt.Sprintf("alias fragment %q longer than %d", frag, maxIdentLen))
		}
	}
}

// aliasOfLength returns a realistic snake_case alias of exactly n bytes.
func aliasOfLength(n int) string {
	if n < 1 || n > maxIdentLen {
		panic(fmt.Sprintf("alias length %d out of range", n))
	}
	for _, frag := range aliasExactFragments {
		if len(frag) == n {
			return frag
		}
	}
	// Compose two fragments with an underscore; prefer longer left sides
	// so we don't get awkward names like "n_account_…".
	for i := len(aliasExactFragments) - 1; i >= 0; i-- {
		left := aliasExactFragments[i]
		if len(left) < 4 {
			continue
		}
		for j := len(aliasExactFragments) - 1; j >= 0; j-- {
			right := aliasExactFragments[j]
			if len(right) < 4 {
				continue
			}
			cand := left + "_" + right
			if len(cand) == n && len(cand) <= maxIdentLen {
				return cand
			}
		}
	}
	panic(fmt.Sprintf("unable to build realistic alias of length %d", n))
}

// buildSelectList returns exactly exactLen chars of realistic projections:
//
//	SELECT id AS <marker>, name AS display_full_name, …, id, name, email
func buildSelectList(exactLen int, markerAlias string) string {
	const finalCols = "id, name, email"
	prefix := "SELECT "
	fillEnd := exactLen - len(finalCols)
	if fillEnd <= len(prefix) {
		panic(fmt.Sprintf("select list length %d too small", exactLen))
	}

	var middle strings.Builder
	middle.WriteString(fmt.Sprintf("id AS %s, ", markerAlias))

	const (
		overhead       = len("id AS ") + len(", ")
		minAliasLen    = 8
		minAdjustable  = overhead + minAliasLen
	)

	for _, p := range selectProjections {
		if p.alias == markerAlias {
			continue
		}
		entry := fmt.Sprintf("%s AS %s, ", p.expr, p.alias)
		// Keep room for one final adjustable "id AS <alias>, " with a readable alias.
		if len(prefix)+middle.Len()+len(entry)+minAdjustable > fillEnd {
			break
		}
		if len(prefix)+middle.Len()+len(entry) == fillEnd {
			middle.WriteString(entry)
			return prefix + middle.String() + finalCols
		}
		middle.WriteString(entry)
	}

	// Consume large leftover gaps with max-length realistic aliases.
	for {
		gap := fillEnd - len(prefix) - middle.Len()
		if gap <= overhead+maxIdentLen {
			break
		}
		middle.WriteString(fmt.Sprintf("id AS %s, ", aliasOfLength(maxIdentLen)))
	}

	gap := fillEnd - len(prefix) - middle.Len()
	switch {
	case gap == 0:
		// already exact
	case gap >= minAdjustable:
		middle.WriteString(fmt.Sprintf("id AS %s, ", aliasOfLength(gap-overhead)))
	default:
		// Absorb a small gap by lengthening the previous alias instead of "id AS c".
		s := middle.String()
		if !strings.HasSuffix(s, ", ") {
			panic("select middle should end with \", \"")
		}
		s = strings.TrimSuffix(s, ", ")
		asIdx := strings.LastIndex(s, " AS ")
		if asIdx < 0 {
			panic("expected AS in select middle")
		}
		expr := s[:asIdx]
		alias := s[asIdx+len(" AS "):]
		grown := alias + aliasOfLength(gap)
		if len(grown) > maxIdentLen {
			panic(fmt.Sprintf("grown alias length %d > %d", len(grown), maxIdentLen))
		}
		middle.Reset()
		middle.WriteString(expr + " AS " + grown + ", ")
	}

	out := prefix + middle.String() + finalCols
	if len(out) != exactLen {
		panic(fmt.Sprintf("select list length %d != %d", len(out), exactLen))
	}
	return out
}

// buildQueryCuttingWord builds SQL where a capture of queryCaptureTruncateAt chars
// ends in the middle of cutWord (e.g. WH|ERE, FR|OM, us|ers). Everything after the
// cut word is a short, realistic clause — no tail padding.
func buildQueryCuttingWord(cutWord, beforeWord, afterWord, marker string) string {
	wordMid := len(cutWord) / 2
	cutStart := queryCaptureTruncateAt - wordMid
	selectLen := cutStart - len(beforeWord)
	if selectLen <= 0 {
		panic(fmt.Sprintf("no room for SELECT list before %q", cutWord))
	}

	q := buildSelectList(selectLen, marker) + beforeWord + cutWord + afterWord
	if got := strings.Index(q, cutWord); got != cutStart {
		// Index returns first match; for "users" ensure we hit the table token after FROM.
		if cutWord == "users" {
			got = strings.Index(q, beforeWord+cutWord)
			if got >= 0 {
				got += len(beforeWord)
			}
		}
		if got != cutStart {
			panic(fmt.Sprintf("%q starts at %d, want %d", cutWord, got, cutStart))
		}
	}
	truncated := q[:queryCaptureTruncateAt]
	if !strings.HasSuffix(truncated, cutWord[:wordMid]) {
		panic(fmt.Sprintf("expected mid-%q cut, suffix=%q", cutWord, truncated[len(truncated)-16:]))
	}
	if !strings.Contains(q, marker) {
		panic(fmt.Sprintf("marker %q missing from query", marker))
	}
	return q
}

type healthResponse struct {
	Status string `json:"status"`
}

type userRow struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func openDB() (*sql.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		envOr("PGHOST", "localhost"),
		envOr("PGPORT", "5432"),
		envOr("PGUSER", "app"),
		envOr("PGPASSWORD", "app"),
		envOr("PGDATABASE", "sql_query"),
	)
	return sql.Open("postgres", dsn)
}

func initSchema(db *sql.DB) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("ping: %w", err)
	}

	_, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT NOT NULL
		)
	`)
	if err != nil {
		return fmt.Errorf("create users table: %w", err)
	}

	var count int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		return fmt.Errorf("count users: %w", err)
	}
	if count == 0 {
		// Plain (non-parameterized) insert used only for seed data.
		_, err = db.ExecContext(ctx, `
			INSERT INTO users (name, email) VALUES
				('alice', 'alice@example.com'),
				('bob', 'bob@example.com')
		`)
		if err != nil {
			return fmt.Errorf("seed users: %w", err)
		}
	}

	// Verify against a fresh statement so we don't accept a raced/transient postgres init.
	var name string
	if err := db.QueryRowContext(ctx, `SELECT name FROM users WHERE name = 'alice'`).Scan(&name); err != nil {
		return fmt.Errorf("verify users table: %w", err)
	}
	return nil
}

func waitForSchema(db *sql.DB, maxAttempts int, delay time.Duration) error {
	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		lastErr = initSchema(db)
		if lastErr == nil {
			return nil
		}
		log.Printf("waiting for schema (%d/%d): %v", attempt, maxAttempts, lastErr)
		time.Sleep(delay)
	}
	return fmt.Errorf("schema not ready after %d attempts: %w", maxAttempts, lastErr)
}

// schemaGate re-checks the table if queries fail after a postgres restart wiped ephemeral storage.
type schemaGate struct {
	db *sql.DB
	mu sync.Mutex
}

func (g *schemaGate) ensure() error {
	g.mu.Lock()
	defer g.mu.Unlock()
	return initSchema(g.db)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func healthHandler(gate *schemaGate) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := gate.ensure(); err != nil {
			log.Printf("healthz schema check failed: %v", err)
			writeJSON(w, http.StatusServiceUnavailable, healthResponse{Status: "not ready"})
			return
		}
		writeJSON(w, http.StatusOK, healthResponse{Status: "healthy"})
	}
}

func runUsersQuery(ctx context.Context, db *sql.DB, query string) ([]userRow, error) {
	// Intentionally plain SQL (no placeholders) so instrumentation sees the full statement.
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	idIdx, nameIdx, emailIdx := columnIndex(cols, "id"), columnIndex(cols, "name"), columnIndex(cols, "email")
	if idIdx < 0 || nameIdx < 0 || emailIdx < 0 {
		return nil, fmt.Errorf("result missing id/name/email columns: %v", cols)
	}

	users := make([]userRow, 0)
	for rows.Next() {
		raw := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range raw {
			ptrs[i] = &raw[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		u := userRow{
			ID:    asInt(raw[idIdx]),
			Name:  asString(raw[nameIdx]),
			Email: asString(raw[emailIdx]),
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return users, nil
}

func columnIndex(cols []string, name string) int {
	for i, c := range cols {
		if c == name {
			return i
		}
	}
	return -1
}

func asInt(v any) int {
	switch n := v.(type) {
	case int64:
		return int(n)
	case int32:
		return int(n)
	case int:
		return n
	case []byte:
		var out int
		_, _ = fmt.Sscan(string(n), &out)
		return out
	default:
		var out int
		_, _ = fmt.Sscan(fmt.Sprint(n), &out)
		return out
	}
}

func asString(v any) string {
	switch s := v.(type) {
	case string:
		return s
	case []byte:
		return string(s)
	default:
		return fmt.Sprint(s)
	}
}

func queryHandler(gate *schemaGate, query string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		users, err := runUsersQuery(r.Context(), gate.db, query)
		if err != nil {
			// Ephemeral postgres may have been recreated after our startup init.
			if ensureErr := gate.ensure(); ensureErr != nil {
				log.Printf("query failed: %v (schema ensure: %v)", err, ensureErr)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
				return
			}
			users, err = runUsersQuery(r.Context(), gate.db, query)
			if err != nil {
				log.Printf("query failed after schema ensure: %v", err)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
				return
			}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"query":       query,
			"queryLength": len(query),
			"users":       users,
		})
	}
}

func main() {
	db, err := openDB()
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := waitForSchema(db, 60, 2*time.Second); err != nil {
		log.Fatal(err)
	}
	log.Println("postgres ready; schema initialized")

	gate := &schemaGate{db: db}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthHandler(gate))
	mux.HandleFunc("/query", queryHandler(gate, plainQuery))
	mux.HandleFunc("/query-truncate-where", queryHandler(gate, queryTruncateWhere))
	mux.HandleFunc("/query-truncate-from", queryHandler(gate, queryTruncateFrom))
	mux.HandleFunc("/query-truncate-table", queryHandler(gate, queryTruncateTable))

	server := &http.Server{
		Addr:              listenAddr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("sql-query server listening on %s", listenAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit

	log.Println("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("forced shutdown: %v", err)
		os.Exit(1)
	}
}
