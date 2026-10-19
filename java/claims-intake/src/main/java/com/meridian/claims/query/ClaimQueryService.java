package com.meridian.claims.query;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.meridian.claims.domain.Claim;
import com.meridian.claims.security.PiiTokenizer;
import com.meridian.claims.security.SessionTokenVerifier;
import com.meridian.claims.security.TenantGuard;
import com.meridian.claims.store.ClaimRepository;

@Service
public class ClaimQueryService {
    private final SessionTokenVerifier tokens;
    private final ClaimRepository claims;
    private final TenantGuard tenantGuard;
    private final PiiTokenizer pii;
    private final ClaimMapper mapper;

    public ClaimQueryService(SessionTokenVerifier tokens, ClaimRepository claims, TenantGuard tenantGuard,
            PiiTokenizer pii, ClaimMapper mapper) {
        this.tokens = tokens;
        this.claims = claims;
        this.tenantGuard = tenantGuard;
        this.pii = pii;
        this.mapper = mapper;
    }

    public Map<String, Object> findClaim(String authorization, String tenantId, String claimId) {
        tokens.verifySessionToken(authorization);
        Claim claim = claims.findById(claimId);
        if (claim == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "unknown claim");
        }
        tenantGuard.enforceTenantIsolation(tenantId, claim);
        return mapper.toView(claim, pii.maskForDisplay(claim.claimantSsnToken()));
    }
}
