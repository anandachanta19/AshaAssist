package com.ashaassist.backend.dto;

import lombok.Data;

/**
 * Data Transfer Object for user information.
 */
@Data
public class UserDto {
    private String username;
    private String fullName;
}