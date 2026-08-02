package com.example.cassandra;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.ResultSet;
import com.datastax.oss.driver.api.core.cql.Row;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class CassandraController {

    private static final Logger log = LoggerFactory.getLogger(CassandraController.class);

    private final CqlSession session;

    public CassandraController(CqlSession session) {
        this.session = session;
    }

    @GetMapping("/healthz")
    public ResponseEntity<Map<String, String>> healthz() {
        try {
            ensureSchema();
            Map<String, String> body = new HashMap<String, String>();
            body.put("status", "healthy");
            return ResponseEntity.ok(body);
        } catch (Exception e) {
            log.warn("healthz schema check failed: {}", e.getMessage());
            Map<String, String> body = new HashMap<String, String>();
            body.put("status", "not ready");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body);
        }
    }

    @GetMapping("/query")
    public ResponseEntity<Map<String, Object>> queryByNameAlice() {
        return runQuery(CassandraConfig.QUERY_BY_NAME_ALICE);
    }

    @GetMapping("/query-bob")
    public ResponseEntity<Map<String, Object>> queryByNameBob() {
        return runQuery(CassandraConfig.QUERY_BY_NAME_BOB);
    }

    @GetMapping("/query-by-id")
    public ResponseEntity<Map<String, Object>> queryByIdAlice() {
        return runQuery(CassandraConfig.QUERY_BY_ID_ALICE);
    }

    @GetMapping("/query-by-id-bob")
    public ResponseEntity<Map<String, Object>> queryByIdBob() {
        return runQuery(CassandraConfig.QUERY_BY_ID_BOB);
    }

    @GetMapping("/query-by-id-carol")
    public ResponseEntity<Map<String, Object>> queryByIdCarol() {
        return runQuery(CassandraConfig.QUERY_BY_ID_CAROL);
    }

    @GetMapping("/query-by-id-in")
    public ResponseEntity<Map<String, Object>> queryByIdIn() {
        return runQuery(CassandraConfig.QUERY_BY_ID_IN);
    }

    @GetMapping("/query-all")
    public ResponseEntity<Map<String, Object>> queryAll() {
        return runQuery(CassandraConfig.QUERY_ALL);
    }

    private ResponseEntity<Map<String, Object>> runQuery(String query) {
        try {
            return ResponseEntity.ok(queryResponse(query, runUsersQuery(query)));
        } catch (Exception e) {
            log.error("query failed: {}", e.getMessage());
            try {
                ensureSchema();
                return ResponseEntity.ok(queryResponse(query, runUsersQuery(query)));
            } catch (Exception retry) {
                log.error("query failed after schema ensure: {}", retry.getMessage());
                Map<String, Object> err = new HashMap<String, Object>();
                err.put("error", "query failed");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
            }
        }
    }

    private Map<String, Object> queryResponse(String query, List<Map<String, Object>> users) {
        Map<String, Object> body = new HashMap<String, Object>();
        body.put("query", query);
        body.put("queryLength", query.length());
        body.put("users", users);
        return body;
    }

    private List<Map<String, Object>> runUsersQuery(String query) {
        // Intentionally plain CQL (no bound statements) so instrumentation sees the full statement.
        ResultSet rs = session.execute(query);
        List<Map<String, Object>> users = new ArrayList<Map<String, Object>>();
        for (Row row : rs) {
            Map<String, Object> user = new HashMap<String, Object>();
            UUID id = row.getUuid("id");
            user.put("id", id == null ? null : id.toString());
            user.put("name", row.getString("name"));
            user.put("email", row.getString("email"));
            users.add(user);
        }
        return users;
    }

    private void ensureSchema() {
        session.execute(
                "CREATE TABLE IF NOT EXISTS users ("
                        + "id uuid PRIMARY KEY, "
                        + "name text, "
                        + "email text)"
        );
        session.execute("CREATE INDEX IF NOT EXISTS users_by_name ON users (name)");
        session.execute(CassandraConfig.insertUserCql(
                CassandraConfig.ALICE_ID, "alice", "alice@example.com"));
        session.execute(CassandraConfig.insertUserCql(
                CassandraConfig.BOB_ID, "bob", "bob@example.com"));
        session.execute(CassandraConfig.insertUserCql(
                CassandraConfig.CAROL_ID, "carol", "carol@example.com"));
        session.execute(CassandraConfig.QUERY_BY_ID_ALICE);
    }
}
