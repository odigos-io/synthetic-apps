package com.meridian.claims.domain;

public record Claim(
        String id,
        String tenantId,
        String policyNumber,
        String claimantSsnToken,
        long amountCents,
        String category,
        int attachments,
        double fraudScore,
        ClaimStatus status,
        long approvedPayoutCents) {

    public Claim withAdjudication(ClaimStatus newStatus, long payoutCents) {
        return new Claim(id, tenantId, policyNumber, claimantSsnToken, amountCents, category, attachments,
                fraudScore, newStatus, payoutCents);
    }
}
