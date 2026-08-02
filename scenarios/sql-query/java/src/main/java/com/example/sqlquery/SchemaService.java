package com.example.sqlquery;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.time.Duration;

/**
 * Creates and seeds the users table, retrying until Postgres is ready.
 */
@Component
public class SchemaService {

    private static final Logger log = LoggerFactory.getLogger(SchemaService.class);

    private final JdbcTemplate jdbc;
    private final Object lock = new Object();

    public SchemaService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostConstruct
    public void waitForSchema() {
        Exception last = null;
        for (int attempt = 1; attempt <= 60; attempt++) {
            try {
                initSchema();
                log.info("postgres ready; schema initialized");
                return;
            } catch (Exception e) {
                last = e;
                log.info("waiting for schema ({}/60): {}", attempt, e.getMessage());
                sleep(Duration.ofSeconds(2));
            }
        }
        throw new IllegalStateException("schema not ready after 60 attempts", last);
    }

    public void ensure() {
        synchronized (lock) {
            initSchema();
        }
    }

    private void initSchema() {
        jdbc.execute(
                "CREATE TABLE IF NOT EXISTS users ("
                        + "id SERIAL PRIMARY KEY, "
                        + "name TEXT NOT NULL, "
                        + "email TEXT NOT NULL)"
        );

        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class);
        if (count != null && count == 0) {
            // Plain (non-parameterized) insert used only for seed data.
            jdbc.execute(
                    "INSERT INTO users (name, email) VALUES "
                            + "('alice', 'alice@example.com'), "
                            + "('bob', 'bob@example.com')"
            );
        }

        // Verify against a fresh statement so we don't accept a raced/transient postgres init.
        String name = jdbc.queryForObject(
                "SELECT name FROM users WHERE name = 'alice'", String.class);
        if (!"alice".equals(name)) {
            throw new IllegalStateException("verify users table failed: got " + name);
        }
    }

    private static void sleep(Duration duration) {
        try {
            Thread.sleep(duration.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("interrupted while waiting for schema", e);
        }
    }
}
