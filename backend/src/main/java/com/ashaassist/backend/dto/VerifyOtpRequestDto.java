package com.ashaassist.backend.dto;

import lombok.Data;

/**
 * Data Transfer Object for OTP verification requests.
 */
@Data
public class VerifyOtpRequestDto {

    private Long visitId;
    private String otp;
}
