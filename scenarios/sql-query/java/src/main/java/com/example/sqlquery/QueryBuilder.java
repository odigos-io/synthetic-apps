package com.example.sqlquery;

/**
 * Builds long SELECT lists so a ~256-char capture cuts mid-word (WHERE / FROM / table).
 * Port of the golang sql-query query builder; keep markers and cut behavior identical.
 */
final class QueryBuilder {

    static final int QUERY_CAPTURE_TRUNCATE_AT = 256;
    static final int MAX_IDENT_LEN = 63;

    static final String PLAIN_QUERY = "SELECT id, name, email FROM users WHERE name = 'alice'";
    // Postgres :: cast operator — used to exercise RemovePostgresCastOperator templatization.
    static final String CAST_QUERY =
            "SELECT id::integer, name::text, email::text FROM users WHERE name = 'alice'::text";

    static final String MARKER_TRUNCATE_WHERE = "status_filter_display_name";
    static final String MARKER_TRUNCATE_FROM = "shipment_source_lookup_key";
    static final String MARKER_TRUNCATE_TABLE = "inventory_catalog_source_key";

    // Lookup tables must be initialized before QUERY_TRUNCATE_* (Java static order).
    private static final String[][] SELECT_PROJECTIONS = {
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
    };

    private static final String[] ALIAS_EXACT_FRAGMENTS = {
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
    };

    static {
        for (String frag : ALIAS_EXACT_FRAGMENTS) {
            if (frag.length() > MAX_IDENT_LEN) {
                throw new IllegalStateException(
                        "alias fragment longer than " + MAX_IDENT_LEN + ": " + frag);
            }
        }
    }

    static final String QUERY_TRUNCATE_WHERE = buildQueryCuttingWord(
            "WHERE", " FROM users ", " name = 'alice'", MARKER_TRUNCATE_WHERE);
    static final String QUERY_TRUNCATE_FROM = buildQueryCuttingWord(
            "FROM", " ", " users WHERE name = 'alice'", MARKER_TRUNCATE_FROM);
    static final String QUERY_TRUNCATE_TABLE = buildQueryCuttingWord(
            "users", " FROM ", " WHERE name = 'alice'", MARKER_TRUNCATE_TABLE);

    private QueryBuilder() {
    }

    static String aliasOfLength(int n) {
        if (n < 1 || n > MAX_IDENT_LEN) {
            throw new IllegalArgumentException("alias length out of range: " + n);
        }
        for (String frag : ALIAS_EXACT_FRAGMENTS) {
            if (frag.length() == n) {
                return frag;
            }
        }
        for (int i = ALIAS_EXACT_FRAGMENTS.length - 1; i >= 0; i--) {
            String left = ALIAS_EXACT_FRAGMENTS[i];
            if (left.length() < 4) {
                continue;
            }
            for (int j = ALIAS_EXACT_FRAGMENTS.length - 1; j >= 0; j--) {
                String right = ALIAS_EXACT_FRAGMENTS[j];
                if (right.length() < 4) {
                    continue;
                }
                String cand = left + "_" + right;
                if (cand.length() == n && cand.length() <= MAX_IDENT_LEN) {
                    return cand;
                }
            }
        }
        throw new IllegalStateException("unable to build realistic alias of length " + n);
    }

    static String buildSelectList(int exactLen, String markerAlias) {
        final String finalCols = "id, name, email";
        final String prefix = "SELECT ";
        int fillEnd = exactLen - finalCols.length();
        if (fillEnd <= prefix.length()) {
            throw new IllegalArgumentException("select list length too small: " + exactLen);
        }

        StringBuilder middle = new StringBuilder();
        middle.append("id AS ").append(markerAlias).append(", ");

        final int overhead = "id AS ".length() + ", ".length();
        final int minAliasLen = 8;
        final int minAdjustable = overhead + minAliasLen;

        for (String[] p : SELECT_PROJECTIONS) {
            if (p[1].equals(markerAlias)) {
                continue;
            }
            String entry = p[0] + " AS " + p[1] + ", ";
            if (prefix.length() + middle.length() + entry.length() + minAdjustable > fillEnd) {
                break;
            }
            if (prefix.length() + middle.length() + entry.length() == fillEnd) {
                middle.append(entry);
                return prefix + middle + finalCols;
            }
            middle.append(entry);
        }

        while (true) {
            int gap = fillEnd - prefix.length() - middle.length();
            if (gap <= overhead + MAX_IDENT_LEN) {
                break;
            }
            middle.append("id AS ").append(aliasOfLength(MAX_IDENT_LEN)).append(", ");
        }

        int gap = fillEnd - prefix.length() - middle.length();
        if (gap == 0) {
            // already exact
        } else if (gap >= minAdjustable) {
            middle.append("id AS ").append(aliasOfLength(gap - overhead)).append(", ");
        } else {
            String s = middle.toString();
            if (!s.endsWith(", ")) {
                throw new IllegalStateException("select middle should end with \", \"");
            }
            s = s.substring(0, s.length() - 2);
            int asIdx = s.lastIndexOf(" AS ");
            if (asIdx < 0) {
                throw new IllegalStateException("expected AS in select middle");
            }
            String expr = s.substring(0, asIdx);
            String alias = s.substring(asIdx + " AS ".length());
            String grown = alias + aliasOfLength(gap);
            if (grown.length() > MAX_IDENT_LEN) {
                throw new IllegalStateException(
                        "grown alias length " + grown.length() + " > " + MAX_IDENT_LEN);
            }
            middle.setLength(0);
            middle.append(expr).append(" AS ").append(grown).append(", ");
        }

        String out = prefix + middle + finalCols;
        if (out.length() != exactLen) {
            throw new IllegalStateException(
                    "select list length " + out.length() + " != " + exactLen);
        }
        return out;
    }

    static String buildQueryCuttingWord(
            String cutWord, String beforeWord, String afterWord, String marker) {
        int wordMid = cutWord.length() / 2;
        int cutStart = QUERY_CAPTURE_TRUNCATE_AT - wordMid;
        int selectLen = cutStart - beforeWord.length();
        if (selectLen <= 0) {
            throw new IllegalArgumentException("no room for SELECT list before " + cutWord);
        }

        String q = buildSelectList(selectLen, marker) + beforeWord + cutWord + afterWord;
        int got = q.indexOf(cutWord);
        if (got != cutStart) {
            if ("users".equals(cutWord)) {
                got = q.indexOf(beforeWord + cutWord);
                if (got >= 0) {
                    got += beforeWord.length();
                }
            }
            if (got != cutStart) {
                throw new IllegalStateException(
                        cutWord + " starts at " + got + ", want " + cutStart);
            }
        }
        String truncated = q.substring(0, QUERY_CAPTURE_TRUNCATE_AT);
        String expectedSuffix = cutWord.substring(0, wordMid);
        if (!truncated.endsWith(expectedSuffix)) {
            throw new IllegalStateException(
                    "expected mid-" + cutWord + " cut, suffix="
                            + truncated.substring(Math.max(0, truncated.length() - 16)));
        }
        if (!q.contains(marker)) {
            throw new IllegalStateException("marker missing from query: " + marker);
        }
        return q;
    }
}
