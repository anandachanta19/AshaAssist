package com.ashaassist.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ashaassist.backend.model.MedicalRecord;

/**
 * Repository interface for {@link MedicalRecord} entities.
 * Provides standard CRUD operations and more complex queries for medical records.
 */
public interface MedicalRecordRepository extends JpaRepository<MedicalRecord, Long> {
}