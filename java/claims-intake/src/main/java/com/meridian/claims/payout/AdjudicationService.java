package com.meridian.claims.payout;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.meridian.claims.domain.Claim;
import com.meridian.claims.domain.ClaimStatus;
import com.meridian.claims.domain.Policy;
import com.meridian.claims.security.AdjusterAuthorizer;
import com.meridian.claims.security.PayoutInstructionSigner;
import com.meridian.claims.security.SessionTokenVerifier;
import com.meridian.claims.security.TenantGuard;
import com.meridian.claims.store.AuditTrail;
import com.meridian.claims.store.ClaimRepository;
import com.meridian.claims.store.PolicyRepository;

@Service
public class AdjudicationService {
    private final SessionTokenVerifier tokens;
    private final ClaimRepository claims;
    private final PolicyRepository policies;
    private final TenantGuard tenantGuard;
    private final AdjusterAuthorizer authorizer;
    private final PayoutCalculator payouts;
    private final PayoutInstructionSigner signer;
    private final AuditTrail audit;

    public AdjudicationService(SessionTokenVerifier tokens, ClaimRepository claims, PolicyRepository policies,
            TenantGuard tenantGuard, AdjusterAuthorizer authorizer, PayoutCalculator payouts,
            PayoutInstructionSigner signer, AuditTrail audit) {
        this.tokens = tokens;
        this.claims = claims;
        this.policies = policies;
        this.tenantGuard = tenantGuard;
        this.authorizer = authorizer;
        this.payouts = payouts;
        this.signer = signer;
        this.audit = audit;
    }

    public record Decision(Claim claim, String signature) {
    }

    public Decision adjudicate(String authorization, String tenantId, String claimId, String adjusterId) {
        tokens.verifySessionToken(authorization);
        Claim claim = claims.findById(claimId);
        if (claim == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "unknown claim");
        }
        tenantGuard.enforceTenantIsolation(tenantId, claim);

        if (!authorizer.authorizeApproval(adjusterId, claim)) {
            Claim denied = claims.save(claim.withAdjudication(ClaimStatus.DENIED, 0));
            audit.record("DENY", claimId, adjusterId);
            return new Decision(denied, "");
        }

        Policy policy = policies.loadPolicy(claim.policyNumber());
        long payout = payouts.calculatePayout(claim, policy);
        String signature = signer.signPayoutInstruction(claimId, payout);
        Claim approved = claims.save(claim.withAdjudication(ClaimStatus.APPROVED, payout));
        audit.record("APPROVE", claimId, adjusterId);
        return new Decision(approved, signature);
    }
}
