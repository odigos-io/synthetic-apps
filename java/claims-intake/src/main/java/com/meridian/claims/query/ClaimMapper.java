package com.meridian.claims.query;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.meridian.claims.domain.Claim;

/** Response shaping. Cheap glue, and not worth a probe; it is here so the evidence has some. */
@Component
public class ClaimMapper {
    public Map<String, Object> toView(Claim claim, String maskedSsn) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", claim.id());
        view.put("policyNumber", claim.policyNumber());
        view.put("claimant", maskedSsn);
        view.put("amountCents", claim.amountCents());
        view.put("category", claim.category());
        view.put("status", claim.status().name());
        view.put("fraudScore", Math.round(claim.fraudScore() * 1000) / 1000.0);
        view.put("approvedPayoutCents", claim.approvedPayoutCents());
        return view;
    }
}
