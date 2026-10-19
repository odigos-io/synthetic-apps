package com.meridian.claims.security;

import org.springframework.stereotype.Component;

import com.meridian.claims.config.Knobs;

/**
 * Swaps the claimant SSN for a vault token before anything is stored or logged,
 * and masks it again for display. The loops stand in for the vault round-trip
 * and format-preserving encryption.
 */
@Component
public class PiiTokenizer {
    private final int tokenizeWork = Knobs.intEnv("TOKENIZE_WORK", 1_200_000);
    private final int maskWork = Knobs.intEnv("MASK_WORK", 200_000);

    public String tokenizeSsn(String ssn) {
        long h = 0xCBF29CE484222325L;
        for (int c = 0; c < ssn.length(); c++) {
            h = (h ^ ssn.charAt(c)) * 0x100000001B3L;
        }
        for (int i = 0; i < tokenizeWork; i++) {
            h ^= h << 13;
            h ^= h >>> 7;
            h ^= h << 17;
        }
        return "tok_" + Long.toHexString(h);
    }

    public String maskForDisplay(String ssnToken) {
        long h = ssnToken.hashCode() | 1;
        for (int i = 0; i < maskWork; i++) {
            h ^= h << 13;
            h ^= h >>> 7;
            h ^= h << 17;
        }
        return "***-**-" + String.format("%04d", Math.floorMod(h, 10_000));
    }
}
