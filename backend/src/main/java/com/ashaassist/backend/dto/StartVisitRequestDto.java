package com.ashaassist.backend.dto;

import java.time.LocalDate;

import lombok.Data;

/**
 * Data Transfer Object for starting a new visit.
 */
@Data
public class StartVisitRequestDto {

    /**
     * The phone number of the patient. This is required.
     */
    private String patientPhoneNumber;

    /**
     * The full name of the patient. This is optional and only used for new patients.
     */
    private String fullName;

    /**
     * The date of birth of the patient. This is optional and only used for new patients.
     */
    private LocalDate dateOfBirth;

    /**
     * The gender of the patient. This is optional and only used for new patients.
     */
    private String gender;

    /**
     * The address of the patient. This is optional and only used for new patients.
     */
    private String address;
}
