package com.meridian.claims.config;

/**
 * Work sizes, read once at startup. The busy loops are written out in each
 * method on purpose: a shared helper would become the hottest application frame
 * in every profile and the model would be asked to probe it. Every loop folds
 * into its return value so the JIT cannot drop it.
 */
public final class Knobs {
    private Knobs() {
    }

    public static int intEnv(String name, int fallback) {
        String v = System.getenv(name);
        if (v == null || v.isBlank()) {
            return fallback;
        }
        try {
            return Integer.parseInt(v.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
