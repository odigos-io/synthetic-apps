package com.example.httpserver;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class HttpServerApplication {

    public static void main(String[] args) {
        System.out.println("Server running at http://127.0.0.1:8080/");
        SpringApplication.run(HttpServerApplication.class, args);
    }
} 