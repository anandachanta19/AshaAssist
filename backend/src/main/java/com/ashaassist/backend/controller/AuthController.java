package com.ashaassist.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ashaassist.backend.dto.JwtAuthResponse;
import com.ashaassist.backend.dto.LoginDto;
import com.ashaassist.backend.dto.RegisterDto;
import com.ashaassist.backend.security.JwtTokenProvider;
import com.ashaassist.backend.service.AuthService;

/**
 * Controller for handling authentication-related requests.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;

    public AuthController(AuthService authService,
            AuthenticationManager authenticationManager,
            JwtTokenProvider tokenProvider) {
        this.authService = authService;
        this.authenticationManager = authenticationManager;
        this.tokenProvider = tokenProvider;
    }

    /**
     * Handles user registration.
     */
    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody RegisterDto registerDto) {
        String response = authService.register(registerDto);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    /**
     * Handles user login.
     * UPDATED: Now uses AuthenticationManager to correctly load roles into the
     * SecurityContext.
     */
    @PostMapping("/login")
    public ResponseEntity<JwtAuthResponse> login(@RequestBody LoginDto loginDto) {

        // 1. Authenticate using the manager (Triggers CustomUserDetailsService)
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        loginDto.getUsername(),
                        loginDto.getPassword()));

        // 2. Set the authentication in the context
        SecurityContextHolder.getContext().setAuthentication(authentication);

        // 3. Generate the token (now includes the ROLE from authentication object)
        String token = tokenProvider.generateToken(authentication);

        // 4. Create Response
        JwtAuthResponse jwtAuthResponse = new JwtAuthResponse();
        jwtAuthResponse.setAccessToken(token);
        jwtAuthResponse.setTokenType("Bearer"); // Ensure your DTO has this field/setter

        return new ResponseEntity<>(jwtAuthResponse, HttpStatus.OK);
    }
}