package com.example.log4shell;

import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseInitializer implements CommandLineRunner {

    private static final int MAX_ATTEMPTS = 30;
    private static final long RETRY_DELAY_MS = 2000;

    private final JdbcTemplate jdbcTemplate;

    public DatabaseInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) throws Exception {
        waitForPostgres();
        initSchema();
        seedProducts();
    }

    private void waitForPostgres() throws InterruptedException {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                jdbcTemplate.queryForObject("SELECT 1", Integer.class);
                return;
            } catch (Exception e) {
                if (attempt == MAX_ATTEMPTS) {
                    throw new IllegalStateException("postgres not ready after " + MAX_ATTEMPTS + " attempts", e);
                }
                System.out.println("waiting for postgres (" + attempt + "/" + MAX_ATTEMPTS + ")...");
                Thread.sleep(RETRY_DELAY_MS);
            }
        }
    }

    private void initSchema() {
        jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS products ("
                        + "id SERIAL PRIMARY KEY, "
                        + "sku TEXT NOT NULL UNIQUE, "
                        + "title TEXT NOT NULL, "
                        + "description TEXT NOT NULL, "
                        + "category TEXT NOT NULL, "
                        + "price NUMERIC(10, 2) NOT NULL"
                        + ")"
        );
    }

    private void seedProducts() {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM products", Integer.class);
        if (count != null && count > 0) {
            return;
        }

        jdbcTemplate.update(
                "INSERT INTO products (sku, title, description, category, price) VALUES "
                        + "('BK-001', 'Distributed Tracing in Practice', 'Guide to tracing microservices with OpenTelemetry', 'books', 49.99), "
                        + "('BK-002', 'Observability Engineering', 'Building reliable production systems with metrics and logs', 'books', 54.50), "
                        + "('BK-003', 'Kubernetes Patterns', 'Reusable components for cloud native applications', 'books', 44.00), "
                        + "('TL-001', 'Prometheus Starter Kit', 'Metrics collection for Kubernetes workloads', 'telemetry', 129.00), "
                        + "('TL-002', 'OpenTelemetry Collector', 'Vendor-neutral telemetry pipeline appliance', 'telemetry', 199.00), "
                        + "('TL-003', 'Log Aggregation Appliance', 'Centralized log storage and search appliance', 'telemetry', 249.00), "
                        + "('TL-004', 'APM Dashboard License', 'Application performance monitoring dashboard subscription', 'telemetry', 89.00)"
        );
    }
}
