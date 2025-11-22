package com.ashaassist.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ashaassist.backend.model.User;
import com.ashaassist.backend.model.Visit;

/**
 * Repository interface for {@link Visit} entities.
 * Provides standard CRUD operations and a custom method to find the most recent
 * visits for a user.
 */
public interface VisitRepository extends JpaRepository<Visit, Long> {
    /**
     * Finds the top 5 most recent visits for a given Asha Karmi, ordered by
     * creation date descending.
     *
     * @param user the Asha Karmi user.
     * @return a list of the 5 most recent visits.
     */
    List<Visit> findTop5ByAshaKarmiOrderByCreatedAtDesc(User user);

    List<Visit> findTop10ByOrderByVerifiedAtDesc();

    List<Visit> findByAshaKarmiId(Long ashaKarmiId);

    List<Visit> findByPatientId(Long patientId);
}
