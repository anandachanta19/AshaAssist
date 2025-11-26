package com.ashaassist.backend.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ashaassist.backend.model.User;
import com.ashaassist.backend.model.Visit;
import com.ashaassist.backend.repository.PatientRepository;
import com.ashaassist.backend.repository.UserRepository;
import com.ashaassist.backend.repository.VisitRepository;

/**
 * Controller for handling administrative tasks and dashboard statistics.
 * Accessible only to users with the 'ADMIN' role.
 */
@RestController
@RequestMapping("/api/admin") // Base path protected by SecurityConfig
public class AdminController {

    private final UserRepository userRepository;
    private final PatientRepository patientRepository;
    private final VisitRepository visitRepository;

    public AdminController(UserRepository userRepository,
            PatientRepository patientRepository,
            VisitRepository visitRepository) {
        this.userRepository = userRepository;
        this.patientRepository = patientRepository;
        this.visitRepository = visitRepository;
    }

    /**
     * Retrieves high-level dashboard statistics.
     * 
     * @return A map containing counts of total visits, patients, and workers.
     */
    @GetMapping("/stats")
    public Map<String, Long> getStats() {
        Map<String, Long> stats = new HashMap<>();
        stats.put("totalVisits", visitRepository.count());
        stats.put("totalPatients", patientRepository.count());
        // This counts ALL users. You can refine this query if needed.
        stats.put("totalWorkers", userRepository.count());
        return stats;
    }

    /**
     * Retrieves the 10 most recent visits from all users.
     * 
     * @return A list of the 10 most recent visits, ordered by verification date
     *         descending.
     */
    @GetMapping("/recent-visits")
    @Transactional(readOnly = true)
    public List<Visit> getRecentVisits() {
        // Use the new repository method
        return visitRepository.findTop10ByOrderByVerifiedAtDesc();
    }

    /**
     * Retrieves a list of all registered users (Asha Karmis).
     * 
     * @return A list of all User entities.
     */
    @GetMapping("/users")
    public List<User> getAllUsers() {
        // In a real app, you would use a UserDTO (Data Transfer Object)
        // to avoid sending the password hash back to the client.
        return userRepository.findAll();
    }

    /**
     * Retrieves a list of all registered patients.
     * 
     * @return A list of all Patient entities.
     */
    @GetMapping("/patients")
    public List<com.ashaassist.backend.model.Patient> getAllPatients() {
        return patientRepository.findAll();
    }

    // --- User Profile Endpoints ---

    /**
     * Retrieves a specific user by their ID.
     * 
     * @param id The ID of the user to retrieve.
     * @return The User entity.
     * @throws RuntimeException if the user is not found.
     */
    @GetMapping("/users/{id}")
    public User getUser(@org.springframework.web.bind.annotation.PathVariable Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    /**
     * Retrieves all visits conducted by a specific Asha Karmi (user).
     * 
     * @param id The ID of the Asha Karmi.
     * @return A list of visits associated with the user.
     */
    @GetMapping("/users/{id}/visits")
    @Transactional(readOnly = true)
    public List<Visit> getUserVisits(@org.springframework.web.bind.annotation.PathVariable Long id) {
        return visitRepository.findByAshaKarmiId(id);
    }

    // --- Patient Profile Endpoints ---

    /**
     * Retrieves a specific patient by their ID.
     * 
     * @param id The ID of the patient to retrieve.
     * @return The Patient entity.
     * @throws RuntimeException if the patient is not found.
     */
    @GetMapping("/patients/{id}")
    public com.ashaassist.backend.model.Patient getPatient(
            @org.springframework.web.bind.annotation.PathVariable Long id) {
        return patientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Patient not found"));
    }

    /**
     * Retrieves all visits associated with a specific patient.
     * 
     * @param id The ID of the patient.
     * @return A list of visits associated with the patient.
     */
    @GetMapping("/patients/{id}/visits")
    @Transactional(readOnly = true)
    public List<Visit> getPatientVisits(@org.springframework.web.bind.annotation.PathVariable Long id) {
        return visitRepository.findByPatientId(id);
    }
}