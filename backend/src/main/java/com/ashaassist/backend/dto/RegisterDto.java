package com.ashaassist.backend.dto;

import lombok.Data;

/**
 * Data Transfer Object for user registration requests.
 */
@Data
public class RegisterDto {

    private String fullName;
    private String username;
    private String password;
}
