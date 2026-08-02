package com.example.sqlquery;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

class QueryBuilderTest {

    @Test
    void truncateQueriesCutMidWord() {
        caseTruncate("where", QueryBuilder.QUERY_TRUNCATE_WHERE,
                QueryBuilder.MARKER_TRUNCATE_WHERE, "WHERE", " name = 'alice'");
        caseTruncate("from", QueryBuilder.QUERY_TRUNCATE_FROM,
                QueryBuilder.MARKER_TRUNCATE_FROM, "FROM", " users WHERE name = 'alice'");
        caseTruncate("table", QueryBuilder.QUERY_TRUNCATE_TABLE,
                QueryBuilder.MARKER_TRUNCATE_TABLE, "users", " WHERE name = 'alice'");
    }

    private static void caseTruncate(
            String name, String q, String marker, String cut, String after) {
        assertTrue(q.contains(marker), name + ": missing marker alias");
        assertFalse(q.contains("LENGTH("), name + ": unexpected LENGTH() tail padding");
        assertFalse(q.contains("xxxx"), name + ": unrealistic xxxx padding still present");
        assertFalse(q.contains("' AS ") || q.contains("AS '"),
                name + ": unexpected string-literal AS pad");

        int mid = cut.length() / 2;
        String truncated = q.substring(0, QueryBuilder.QUERY_CAPTURE_TRUNCATE_AT);
        if (!truncated.endsWith(cut.substring(0, mid))) {
            fail(name + ": suffix=" + truncated.substring(Math.max(0, truncated.length() - 20))
                    + " want mid-" + cut + " (" + cut.substring(0, mid) + ")");
        }
        if (!q.endsWith(cut + after)) {
            fail(name + ": query should end with short realistic clause, got ..."
                    + q.substring(Math.max(0, q.length() - 40)));
        }
        String afterCut = q.substring(QueryBuilder.QUERY_CAPTURE_TRUNCATE_AT);
        if (afterCut.length() > 64) {
            fail(name + ": tail after 256-char mark too long: " + afterCut.length()
                    + " chars (" + afterCut + ")");
        }
    }
}
