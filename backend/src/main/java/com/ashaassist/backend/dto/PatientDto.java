package com.ashaassist.backend.dto;

import lombok.Data;

/**
 * Data Transfer Object for patient information.
 */
@Data
public class PatientDto {

    private String phoneNumber;
    private String fullName;
}
