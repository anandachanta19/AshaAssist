package com.ashaassist.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ashaassist.backend.repository.PatientRepository;

/**
 * Controller for handling patient-related requests.
 */
@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientRepository patientRepository;

    /**
     * Constructs a new {@code PatientController} with the specified patient repository.
     *
     * @param patientRepository the repository to use for patient data access.
     */
    public PatientController(PatientRepository patientRepository) {
        this.patientRepository = patientRepository;
    }

    /**
     * Checks if a patient exists with the given phone number.
     *
     * @param phoneNumber the phone number to check.
     * @return a {@link ResponseEntity} with a boolean indicating whether the patient exists and HTTP status 200 (OK).
     */
    @GetMapping("/exists/{phoneNumber}")
    public ResponseEntity<Boolean> doesPatientExist(@PathVariable String phoneNumber) {
        boolean exists = patientRepository.findByPhoneNumber(phoneNumber).isPresent();
        return ResponseEntity.ok(exists);
    }
}