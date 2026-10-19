package com.meridian.claims.api;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.meridian.claims.domain.Claim;
import com.meridian.claims.domain.ClaimSubmission;
import com.meridian.claims.intake.ClaimIntakeService;
import com.meridian.claims.payout.AdjudicationService;
import com.meridian.claims.query.ClaimQueryService;

@RestController
@RequestMapping("/claims")
public class ClaimsController {
    private final ClaimIntakeService intake;
    private final ClaimQueryService query;
    private final AdjudicationService adjudication;

    public ClaimsController(ClaimIntakeService intake, ClaimQueryService query, AdjudicationService adjudication) {
        this.intake = intake;
        this.query = query;
        this.adjudication = adjudication;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> submit(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestHeader(name = "X-Tenant-Id", required = false) String tenantId,
            @RequestBody ClaimSubmission submission) {
        Claim claim = intake.submitClaim(authorization, tenantId, submission);
        return Map.of(
                "id", claim.id(),
                "status", claim.status().name(),
                "fraudScore", Math.round(claim.fraudScore() * 1000) / 1000.0);
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestHeader(name = "X-Tenant-Id", required = false) String tenantId,
            @PathVariable("id") String id) {
        return query.findClaim(authorization, tenantId, id);
    }

    @PostMapping("/{id}/approve")
    public Map<String, Object> approve(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestHeader(name = "X-Tenant-Id", required = false) String tenantId,
            @RequestHeader(name = "X-Adjuster-Id", required = false) String adjusterId,
            @PathVariable("id") String id) {
        AdjudicationService.Decision decision = adjudication.adjudicate(authorization, tenantId, id, adjusterId);
        return Map.of(
                "id", decision.claim().id(),
                "status", decision.claim().status().name(),
                "payoutCents", decision.claim().approvedPayoutCents(),
                "signature", decision.signature());
    }
}
