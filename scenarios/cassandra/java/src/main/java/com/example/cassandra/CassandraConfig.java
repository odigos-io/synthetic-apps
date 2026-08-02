package com.example.cassandra;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.CqlSessionBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PreDestroy;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.UUID;

@Configuration
public class CassandraConfig {

    private static final Logger log = LoggerFactory.getLogger(CassandraConfig.class);

    static final String KEYSPACE = "demo";

    static final String ALICE_ID = "8f14e45f-ceea-467c-9a7e-3f8c1b2a9d01";
    static final String BOB_ID = "2d711642-b01b-4c8b-9a7e-5e3f1a0c8b22";
    static final String CAROL_ID = "c56a4180-65aa-42ec-a945-5fd21dec0538";

    static final String QUERY_BY_NAME_ALICE =
            "SELECT id, name, email FROM users WHERE name = 'alice'";
    static final String QUERY_BY_NAME_BOB =
            "SELECT id, name, email FROM users WHERE name = 'bob'";
    static final String QUERY_BY_ID_ALICE =
            "SELECT id, name, email FROM users WHERE id = " + ALICE_ID;
    static final String QUERY_BY_ID_BOB =
            "SELECT id, name, email FROM users WHERE id = " + BOB_ID;
    static final String QUERY_BY_ID_CAROL =
            "SELECT id, name, email FROM users WHERE id = " + CAROL_ID;
    // No space after commas in the IN list (intentional capture shape for instrumentation).
    static final String QUERY_BY_ID_IN =
            "SELECT id, name, email FROM users WHERE id IN (" + ALICE_ID + "," + BOB_ID + ")";
    static final String QUERY_ALL =
            "SELECT id, name, email FROM users";

    @Value("${CASSANDRA_HOST:localhost}")
    private String host;

    @Value("${CASSANDRA_PORT:9042}")
    private int port;

    @Value("${CASSANDRA_DATACENTER:datacenter1}")
    private String datacenter;

    private CqlSession session;

    @Bean
    public CqlSession cqlSession() {
        waitForCassandra();
        initSchema();
        log.info("cassandra ready; schema initialized at {}:{}", host, port);
        return session;
    }

    @PreDestroy
    public void close() {
        if (session != null && !session.isClosed()) {
            session.close();
        }
    }

    private void waitForCassandra() {
        Exception last = null;
        for (int attempt = 1; attempt <= 60; attempt++) {
            try {
                closeQuietly();
                session = newSession(null);
                session.execute("SELECT release_version FROM system.local");
                return;
            } catch (Exception e) {
                last = e;
                log.info("waiting for cassandra ({}/60): {}", attempt, e.getMessage());
                sleep(Duration.ofSeconds(2));
            }
        }
        throw new IllegalStateException("cassandra not ready after 60 attempts", last);
    }

    private CqlSession newSession(String keyspace) {
        CqlSessionBuilder builder = CqlSession.builder()
                .addContactPoint(new InetSocketAddress(host, port))
                .withLocalDatacenter(datacenter);
        if (keyspace != null) {
            builder = builder.withKeyspace(keyspace);
        }
        return builder.build();
    }

    private void initSchema() {
        session.execute(
                "CREATE KEYSPACE IF NOT EXISTS " + KEYSPACE
                        + " WITH replication = {'class':'SimpleStrategy', 'replication_factor':1}"
        );

        // Reconnect with the keyspace so plain queries do not need a keyspace prefix.
        closeQuietly();
        session = newSession(KEYSPACE);

        // id is the partition key so UUID lookups are efficient; name index supports /query-by-name.
        session.execute(
                "CREATE TABLE IF NOT EXISTS users ("
                        + "id uuid PRIMARY KEY, "
                        + "name text, "
                        + "email text)"
        );
        session.execute("CREATE INDEX IF NOT EXISTS users_by_name ON users (name)");

        // Intentionally plain CQL (no bound statements) so instrumentation sees the full statement.
        session.execute(insertUserCql(ALICE_ID, "alice", "alice@example.com"));
        session.execute(insertUserCql(BOB_ID, "bob", "bob@example.com"));
        session.execute(insertUserCql(CAROL_ID, "carol", "carol@example.com"));

        // Verify against a fresh statement so we don't accept a raced/transient init.
        session.execute(QUERY_BY_ID_ALICE);
    }

    static String insertUserCql(String id, String name, String email) {
        return "INSERT INTO users (id, name, email) VALUES ("
                + UUID.fromString(id) + ", '" + name + "', '" + email + "') IF NOT EXISTS";
    }

    private void closeQuietly() {
        if (session != null && !session.isClosed()) {
            session.close();
        }
        session = null;
    }

    private static void sleep(Duration duration) {
        try {
            Thread.sleep(duration.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("interrupted while waiting for cassandra", e);
        }
    }
}
