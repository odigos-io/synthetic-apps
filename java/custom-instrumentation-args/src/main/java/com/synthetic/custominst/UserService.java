package com.synthetic.custominst;

import org.springframework.stereotype.Service;

/**
 * UserService.getUser is a custom-instrumentation target: it takes a single
 * string argument (the user id) and returns a string. Under normal traffic the
 * id is always numeric, so Odigos Insights learns arg.0 as the "numeric" format.
 * A tampered id (e.g. "1 OR 1=1") arrives as free-form text and trips the D4
 * argument-format check.
 */
@Service
public class UserService {

    public String getUser(String id) {
        // Deliberately trivial: the point is the SHAPE of the argument, not the
        // lookup. A real SQLi payload would reach a query here.
        return "{\"id\":\"" + id + "\",\"name\":\"user-" + id + "\"}";
    }
}
