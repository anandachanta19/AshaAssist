package com.ashaassist.backend.dto;

import java.time.LocalDateTime;

import lombok.Data;

/**
 * Data Transfer Object for medical records.
 */
@Data
public class MedicalRecordDto {
    private Long id;
    private String rawTranscript;
    private String structuredData;
    private LocalDateTime createdAt;
}