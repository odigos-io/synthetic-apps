package com.example.httpserverjavalin;

import io.javalin.Javalin;

public class HttpServerJavalinApplication {

    private static final int PORT = 8080;

    public static void main(String[] args) {
        // Create Javalin app
        Javalin app = Javalin.create(config -> {
            config.showJavalinBanner = false;
        });

        // Simple health endpoint
        app.get("/health", ctx -> {
            ctx.result("healthy");
            ctx.status(200);
        });

        // Root endpoint
        app.get("/", ctx -> {
            ctx.json(new Response("Java HTTP Server is running"));
        });

        // Templated endpoint with path parameter
        app.get("/users/{id}", ctx -> {
            String userId = ctx.pathParam("id");
            ctx.json(new UserResponse(userId));
        });

        System.out.println("Server running at http://127.0.0.1:" + PORT + "/");
        app.start(PORT);
    }

    public static class Response {
        private String message;

        public Response(String message) {
            this.message = message;
        }

        public String getMessage() {
            return message;
        }
    }

    public static class UserResponse {
        private String id;
        private String message;

        public UserResponse(String id) {
            this.id = id;
            this.message = "User with ID: " + id;
        }

        public String getId() {
            return id;
        }

        public String getMessage() {
            return message;
        }
    }
}
