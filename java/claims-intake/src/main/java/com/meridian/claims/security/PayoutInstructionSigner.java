package com.meridian.claims.security;

import org.springframework.stereotype.Component;

import com.meridian.claims.config.Knobs;

/** Signs the payout instruction sent to the bank. The loop stands in for the HSM-backed signature. */
@Component
public class PayoutInstructionSigner {
    private final int work = Knobs.intEnv("SIGN_WORK", 1_500_000);

    public String signPayoutInstruction(String claimId, long payoutCents) {
        long s = claimId.hashCode() * 31L + payoutCents;
        for (int i = 0; i < work; i++) {
            s = Long.rotateLeft(s * 0x9E3779B97F4A7C15L, 23) ^ (s >>> 41);
        }
        return "sig_" + Long.toHexString(s);
    }
}
