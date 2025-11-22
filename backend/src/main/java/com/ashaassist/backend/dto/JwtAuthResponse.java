package com.ashaassist.backend.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data Transfer Object for JWT authentication responses.
 */
@Data
@NoArgsConstructor
public class JwtAuthResponse {

    private String accessToken;
    private String tokenType = "Bearer";

    /**
     * Constructs a new {@code JwtAuthResponse} with the specified access token and token type.
     *
     * @param accessToken the JWT access token.
     * @param tokenType   the type of token (e.g., "Bearer").
     */
    public JwtAuthResponse(String accessToken, String tokenType) {
        this.accessToken = accessToken;
        this.tokenType = tokenType;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getTokenType() {
        return tokenType;
    }

    public void setTokenType(String tokenType) {
        this.tokenType = tokenType;
    }
}
