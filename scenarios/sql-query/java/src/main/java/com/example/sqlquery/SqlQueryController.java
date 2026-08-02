package com.example.sqlquery;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
public class SqlQueryController {

    private static final Logger log = LoggerFactory.getLogger(SqlQueryController.class);

    private final JdbcTemplate jdbc;
    private final SchemaService schema;

    public SqlQueryController(JdbcTemplate jdbc, SchemaService schema) {
        this.jdbc = jdbc;
        this.schema = schema;
    }

    @GetMapping("/healthz")
    public ResponseEntity<Map<String, String>> healthz() {
        try {
            schema.ensure();
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
    public ResponseEntity<Map<String, Object>> query() {
        return runQuery(QueryBuilder.PLAIN_QUERY);
    }

    @GetMapping("/query-cast")
    public ResponseEntity<Map<String, Object>> queryCast() {
        return runQuery(QueryBuilder.CAST_QUERY);
    }

    @GetMapping("/query-truncate-where")
    public ResponseEntity<Map<String, Object>> queryTruncateWhere() {
        return runQuery(QueryBuilder.QUERY_TRUNCATE_WHERE);
    }

    @GetMapping("/query-truncate-from")
    public ResponseEntity<Map<String, Object>> queryTruncateFrom() {
        return runQuery(QueryBuilder.QUERY_TRUNCATE_FROM);
    }

    @GetMapping("/query-truncate-table")
    public ResponseEntity<Map<String, Object>> queryTruncateTable() {
        return runQuery(QueryBuilder.QUERY_TRUNCATE_TABLE);
    }

    private ResponseEntity<Map<String, Object>> runQuery(String query) {
        try {
            return ResponseEntity.ok(queryResponse(query, runUsersQuery(query)));
        } catch (Exception e) {
            // Ephemeral postgres may have been recreated after our startup init.
            log.error("query failed: {}", e.getMessage());
            try {
                schema.ensure();
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
        // Intentionally plain SQL (no placeholders) so instrumentation sees the full statement.
        return jdbc.query(query, rs -> {
            List<Map<String, Object>> users = new ArrayList<Map<String, Object>>();
            int idIdx = rs.findColumn("id");
            int nameIdx = rs.findColumn("name");
            int emailIdx = rs.findColumn("email");
            while (rs.next()) {
                Map<String, Object> user = new HashMap<String, Object>();
                user.put("id", rs.getInt(idIdx));
                user.put("name", rs.getString(nameIdx));
                user.put("email", rs.getString(emailIdx));
                users.add(user);
            }
            return users;
        });
    }
}
