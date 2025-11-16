package com.ashaassist.backend.dto;

import lombok.Data;

/**
 * Data Transfer Object for transcription responses.
 */
@Data
public class TranscriptionResponseDto {

    private Long medicalRecordId;
    private String transcript;

    /**
     * Constructs a new {@code TranscriptionResponseDto} with the specified medical record ID and transcript.
     *
     * @param medicalRecordId the ID of the medical record.
     * @param transcript      the transcribed text.
     */
    public TranscriptionResponseDto(Long medicalRecordId, String transcript) {
        this.medicalRecordId = medicalRecordId;
        this.transcript = transcript;
    }

    public Long getMedicalRecordId() {
        return medicalRecordId;
    }

    public void setMedicalRecordId(Long medicalRecordId) {
        this.medicalRecordId = medicalRecordId;
    }

    public String getTranscript() {
        return transcript;
    }

    public void setTranscript(String transcript) {
        this.transcript = transcript;
    }
}
