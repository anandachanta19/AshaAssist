package com.ashaassist.backend.service;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.ashaassist.backend.dto.JwtAuthResponse;
import com.ashaassist.backend.dto.LoginDto;
import com.ashaassist.backend.dto.RegisterDto;
import com.ashaassist.backend.model.User;
import com.ashaassist.backend.repository.UserRepository;
import com.ashaassist.backend.security.JwtTokenProvider;

/**
 * Service class for handling authentication-related operations such as user
 * registration and login.
 */
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;

    /**
     * Constructs a new {@code AuthService} with the specified dependencies.
     *
     * @param userRepository        the repository for user data access.
     * @param passwordEncoder       the encoder for hashing passwords.
     * @param authenticationManager the manager for handling authentication
     *                              requests.
     * @param jwtTokenProvider      the provider for generating JWTs.
     */
    public AuthService(UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            JwtTokenProvider jwtTokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    /**
     * Registers a new user in the system.
     *
     * @param registerDto the data transfer object containing registration
     *                    information.
     * @return a success message upon successful registration.
     * @throws RuntimeException if the username is already taken.
     */
    public String register(RegisterDto registerDto) {
        // Check if username already exists
        if (userRepository.findByUsername(registerDto.getUsername()).isPresent()) {
            throw new RuntimeException("Username is already taken!");
        }

        User user = new User();
        user.setFullName(registerDto.getFullName());
        user.setUsername(registerDto.getUsername());
        user.setPassword(passwordEncoder.encode(registerDto.getPassword())); // Encrypt password

        userRepository.save(user);

        return "User registered successfully!";
    }

    /**
     * Authenticates a user and returns a JWT.
     *
     * @param loginDto the data transfer object containing login credentials.
     * @return a {@link JwtAuthResponse} containing the access token.
     */
    public JwtAuthResponse login(LoginDto loginDto) {
        Authentication authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
                loginDto.getUsername(),
                loginDto.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);

        String token = jwtTokenProvider.generateToken(authentication);

        return new JwtAuthResponse(token, "Bearer");
    }
}