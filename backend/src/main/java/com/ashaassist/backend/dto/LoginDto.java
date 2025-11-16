package com.ashaassist.backend.dto;

import lombok.Data;

/**
 * Data Transfer Object for user login requests.
 */
@Data
public class LoginDto {

    private String username;
    private String password;
}
