package com.ashaassist.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * A simple controller for testing secured endpoints.
 */
@RestController
@RequestMapping("/api/test")
public class TestController {

    /**
     * A test endpoint that returns a simple string message.
     * This endpoint is secured and requires authentication.
     *
     * @return a {@link ResponseEntity} with a test message and HTTP status 200 (OK).
     */
    @GetMapping("/hello")
    public ResponseEntity<String> sayHello() {
        return ResponseEntity.ok("Hello from a secured endpoint!");
    }
}