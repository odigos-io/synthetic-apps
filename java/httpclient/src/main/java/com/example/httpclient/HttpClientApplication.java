package com.example.httpclient;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class HttpClientApplication {

    public static void main(String[] args) {
        System.out.println("Server running at http://127.0.0.1:8080/");
        SpringApplication.run(HttpClientApplication.class, args);
    }
}
