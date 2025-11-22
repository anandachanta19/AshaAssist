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
     * Endpoint to get high-level dashboard statistics.
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
     * Endpoint to get the 10 most recent visits from *all* users.
     */
    @GetMapping("/recent-visits")
    @Transactional(readOnly = true)
    public List<Visit> getRecentVisits() {
        // Use the new repository method
        return visitRepository.findTop10ByOrderByVerifiedAtDesc();
    }

    /**
     * Endpoint to get a list of all users (Asha Karmis).
     */
    @GetMapping("/users")
    public List<User> getAllUsers() {
        // In a real app, you would use a UserDTO (Data Transfer Object)
        // to avoid sending the password hash back to the client.
        return userRepository.findAll();
    }

    /**
     * Endpoint to get a list of all patients.
     */
    @GetMapping("/patients")
    public List<com.ashaassist.backend.model.Patient> getAllPatients() {
        return patientRepository.findAll();
    }

    // --- User Profile Endpoints ---

    @GetMapping("/users/{id}")
    public User getUser(@org.springframework.web.bind.annotation.PathVariable Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    @GetMapping("/users/{id}/visits")
    @Transactional(readOnly = true)
    public List<Visit> getUserVisits(@org.springframework.web.bind.annotation.PathVariable Long id) {
        return visitRepository.findByAshaKarmiId(id);
    }

    // --- Patient Profile Endpoints ---

    @GetMapping("/patients/{id}")
    public com.ashaassist.backend.model.Patient getPatient(
            @org.springframework.web.bind.annotation.PathVariable Long id) {
        return patientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Patient not found"));
    }

    @GetMapping("/patients/{id}/visits")
    @Transactional(readOnly = true)
    public List<Visit> getPatientVisits(@org.springframework.web.bind.annotation.PathVariable Long id) {
        return visitRepository.findByPatientId(id);
    }
}