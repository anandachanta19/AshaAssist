package com.ashaassist.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ashaassist.backend.model.Patient;

/**
 * Repository interface for {@link Patient} entities.
 * Provides standard CRUD operations and a custom method to find a patient by phone number.
 */
public interface PatientRepository extends JpaRepository<Patient, Long> {
    /**
     * Finds a patient by their phone number.
     *
     * @param phoneNumber the phone number to search for.
     * @return an {@link Optional} containing the patient if found, or empty otherwise.
     */
    Optional<Patient> findByPhoneNumber(String phoneNumber);
}