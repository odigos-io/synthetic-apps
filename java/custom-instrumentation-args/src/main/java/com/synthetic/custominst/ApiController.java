package com.synthetic.custominst;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ApiController {

    private final UserService userService;
    private final AuthorizationService authorizationService;

    public ApiController(UserService userService, AuthorizationService authorizationService) {
        this.userService = userService;
        this.authorizationService = authorizationService;
    }

    // GET /user?id=42 -> UserService.getUser(id) (custom-instrumented; arg.0 = id)
    @GetMapping("/user")
    public ResponseEntity<Map<String, Object>> user(@RequestParam(defaultValue = "1") String id) {
        String user = userService.getUser(id);
        Map<String, Object> body = new HashMap<>();
        body.put("user", user);
        return ResponseEntity.ok(body);
    }

    // GET /authorize?role=user -> AuthorizationService.checkRole(role) (custom-instrumented; arg.0 = role)
    @GetMapping("/authorize")
    public ResponseEntity<Map<String, Object>> authorize(@RequestParam(defaultValue = "user") String role) {
        String decision = authorizationService.checkRole(role);
        Map<String, Object> body = new HashMap<>();
        body.put("role", role);
        body.put("decision", decision);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> body = new HashMap<>();
        body.put("status", "healthy");
        body.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        return ResponseEntity.ok(body);
    }
}
