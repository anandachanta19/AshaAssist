package com.ashaassist.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ashaassist.backend.dto.JwtAuthResponse;
import com.ashaassist.backend.dto.LoginDto;
import com.ashaassist.backend.dto.RegisterDto;
import com.ashaassist.backend.service.AuthService;

/**
 * Controller for handling authentication-related requests, such as user registration and login.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    /**
     * Constructs a new {@code AuthController} with the specified authentication service.
     *
     * @param authService the service to use for authentication operations.
     */
    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * Handles user registration requests.
     *
     * @param registerDto the data transfer object containing registration information.
     * @return a {@link ResponseEntity} with a success message and HTTP status 201 (Created).
     */
    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody RegisterDto registerDto) {
        String response = authService.register(registerDto);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    /**
     * Handles user login requests.
     *
     * @param loginDto the data transfer object containing login credentials.
     * @return a {@link ResponseEntity} with a JWT authentication response and HTTP status 200 (OK).
     */
    @PostMapping("/login")
    public ResponseEntity<JwtAuthResponse> login(@RequestBody LoginDto loginDto) {
        JwtAuthResponse jwtAuthResponse = authService.login(loginDto);
        return new ResponseEntity<>(jwtAuthResponse, HttpStatus.OK);
    }
}