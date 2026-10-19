package com.meridian.claims.domain;

/** Body of POST /claims as sent by partner portals. */
public record ClaimSubmission(
        String policyNumber,
        String claimantSsn,
        long amountCents,
        String category,
        int attachments,
        String description) {
}
