package main

import (
	"strings"
	"testing"
)

func TestTruncateQueries(t *testing.T) {
	cases := []struct {
		name   string
		q      string
		marker string
		cut    string
		after  string
	}{
		{"where", queryTruncateWhere, markerTruncateWhere, "WHERE", " name = 'alice'"},
		{"from", queryTruncateFrom, markerTruncateFrom, "FROM", " users WHERE name = 'alice'"},
		{"table", queryTruncateTable, markerTruncateTable, "users", " WHERE name = 'alice'"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if !strings.Contains(tc.q, tc.marker) {
				t.Fatal("missing marker alias")
			}
			if strings.Contains(tc.q, "LENGTH(") {
				t.Fatal("unexpected LENGTH() tail padding")
			}
			if strings.Contains(tc.q, "xxxx") {
				t.Fatalf("unrealistic xxxx padding still present: %s", tc.q)
			}
			if strings.Contains(tc.q, "' AS ") || strings.Contains(tc.q, "AS '") {
				t.Fatal("unexpected string-literal AS pad")
			}
			mid := len(tc.cut) / 2
			truncated := tc.q[:queryCaptureTruncateAt]
			if !strings.HasSuffix(truncated, tc.cut[:mid]) {
				t.Fatalf("suffix=%q want mid-%s (%q)", truncated[len(truncated)-20:], tc.cut, tc.cut[:mid])
			}
			if !strings.HasSuffix(tc.q, tc.cut+tc.after) {
				t.Fatalf("query should end with short realistic clause, got ...%q", tc.q[len(tc.q)-40:])
			}
			afterCut := tc.q[queryCaptureTruncateAt:]
			if len(afterCut) > 64 {
				t.Fatalf("tail after 256-char mark too long: %d chars (%q)", len(afterCut), afterCut)
			}
			t.Logf("query=%s", tc.q)
			t.Logf("len=%d tail_after_256=%q", len(tc.q), afterCut)
		})
	}
}
