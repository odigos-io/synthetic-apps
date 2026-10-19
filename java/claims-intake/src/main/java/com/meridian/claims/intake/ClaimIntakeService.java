package com.meridian.claims.intake;

import org.springframework.stereotype.Service;

import com.meridian.claims.domain.Claim;
import com.meridian.claims.domain.ClaimStatus;
import com.meridian.claims.domain.ClaimSubmission;
import com.meridian.claims.domain.Policy;
import com.meridian.claims.fraud.FraudScoringEngine;
import com.meridian.claims.security.PiiTokenizer;
import com.meridian.claims.security.SessionTokenVerifier;
import com.meridian.claims.store.AuditTrail;
import com.meridian.claims.store.ClaimRepository;

@Service
public class ClaimIntakeService {
    private static final double REVIEW_THRESHOLD = 0.8;

    private final SessionTokenVerifier tokens;
    private final PolicyEligibilityChecker eligibility;
    private final PiiTokenizer pii;
    private final FraudScoringEngine fraud;
    private final ClaimDocumentRenderer renderer;
    private final ClaimRepository claims;
    private final AuditTrail audit;

    public ClaimIntakeService(SessionTokenVerifier tokens, PolicyEligibilityChecker eligibility, PiiTokenizer pii,
            FraudScoringEngine fraud, ClaimDocumentRenderer renderer, ClaimRepository claims, AuditTrail audit) {
        this.tokens = tokens;
        this.eligibility = eligibility;
        this.pii = pii;
        this.fraud = fraud;
        this.renderer = renderer;
        this.claims = claims;
        this.audit = audit;
    }

    public Claim submitClaim(String authorization, String tenantId, ClaimSubmission submission) {
        String partner = tokens.verifySessionToken(authorization);
        Policy policy = eligibility.validateCoverage(tenantId, submission);
        String ssnToken = pii.tokenizeSsn(submission.claimantSsn());
        double fraudScore = fraud.scoreClaim(submission, policy);

        String id = claims.nextId();
        renderer.renderClaimSummary(id, submission);
        ClaimStatus status = fraudScore >= REVIEW_THRESHOLD ? ClaimStatus.UNDER_REVIEW : ClaimStatus.RECEIVED;
        Claim claim = claims.save(new Claim(id, tenantId, policy.policyNumber(), ssnToken, submission.amountCents(),
                submission.category(), submission.attachments(), fraudScore, status, 0));
        audit.record("SUBMIT", id, partner);
        return claim;
    }
}
