package com.synthetic.custominst;

import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * AuthorizationService.checkRole is a custom-instrumentation target with a
 * low-cardinality (categorical) argument: under normal traffic the role is
 * always one of a small set (user / admin / guest), so Odigos Insights learns
 * arg.0 as a bounded enum. A privilege-escalation attempt like "superadmin"
 * shares the same (token) format but is outside the learned set, tripping the
 * D4 enum check.
 */
@Service
public class AuthorizationService {

    private static final Set<String> KNOWN_ROLES = Set.of("user", "admin", "guest");

    public String checkRole(String role) {
        return KNOWN_ROLES.contains(role) ? "granted" : "denied";
    }
}
