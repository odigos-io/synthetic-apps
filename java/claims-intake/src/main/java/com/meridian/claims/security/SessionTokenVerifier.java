package com.meridian.claims.security;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.meridian.claims.config.Knobs;

/**
 * Verifies the partner portal's bearer token. The loop stands in for the HMAC
 * check; any non-blank token is accepted so the demo needs no key setup.
 */
@Component
public class SessionTokenVerifier {
    private final int work = Knobs.intEnv("TOKEN_VERIFY_WORK", 800_000);

    public String verifySessionToken(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ") || authorization.length() <= 7) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "missing bearer token");
        }
        String token = authorization.substring(7);
        long mac = token.hashCode() | 1;
        for (int i = 0; i < work; i++) {
            mac = Long.rotateLeft(mac ^ (mac >>> 33), 17) * 0xFF51AFD7ED558CCDL;
        }
        return mac == 0 ? "" : "partner:" + token.substring(0, Math.min(8, token.length()));
    }
}
