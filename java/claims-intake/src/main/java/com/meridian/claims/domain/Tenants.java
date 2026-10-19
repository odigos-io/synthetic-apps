package com.meridian.claims.domain;

/** Seeded tenants. Seed record n belongs to tenant n % 3; the load generator relies on that. */
public final class Tenants {
    public static final String[] ALL = {"acme-logistics", "brightside-health", "coastal-fleet"};

    private Tenants() {
    }

    public static String forSeed(int n) {
        return ALL[n % ALL.length];
    }
}
