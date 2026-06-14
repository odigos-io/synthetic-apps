package com.example.log4shell;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class ProductRepository {

    private static final RowMapper<Product> PRODUCT_MAPPER = (rs, rowNum) -> new Product(
            rs.getInt("id"),
            rs.getString("sku"),
            rs.getString("title"),
            rs.getString("description"),
            rs.getString("category"),
            rs.getDouble("price")
    );

    private final JdbcTemplate jdbcTemplate;

    public ProductRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Product> search(String query, String category) {
        String term = query == null ? "" : query.trim();
        String categoryFilter = category == null ? "" : category.trim();
        String pattern = "%" + term + "%";

        return jdbcTemplate.query(
                "SELECT id, sku, title, description, category, price "
                        + "FROM products "
                        + "WHERE (title ILIKE ? OR description ILIKE ? OR sku ILIKE ?) "
                        + "AND (? = '' OR category = ?) "
                        + "ORDER BY title "
                        + "LIMIT 25",
                PRODUCT_MAPPER,
                pattern, pattern, pattern, categoryFilter, categoryFilter
        );
    }

    public boolean isHealthy() {
        Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
        return result != null && result == 1;
    }
}
