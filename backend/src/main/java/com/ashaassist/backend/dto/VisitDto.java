package com.ashaassist.backend.dto;

import java.time.LocalDateTime;

import com.ashaassist.backend.model.Visit;

import lombok.Data;

/**
 * Data Transfer Object for visit information.
 */
@Data
public class VisitDto {

    private Long id;
    private LocalDateTime verifiedAt;
    private PatientDto patient;
    private UserDto ashaKarmi;
    private MedicalRecordDto medicalRecord;

    /**
     * Constructs a new {@code VisitDto} from a {@link Visit} entity.
     *
     * @param visit the visit entity to convert.
     */
    public VisitDto(Visit visit) {
        this.id = visit.getId();
        this.verifiedAt = visit.getVerifiedAt();

        PatientDto patientDto = new PatientDto();
        patientDto.setPhoneNumber(visit.getPatient().getPhoneNumber());
        patientDto.setFullName(visit.getPatient().getFullName());
        this.patient = patientDto;

        UserDto userDto = new UserDto();
        userDto.setUsername(visit.getAshaKarmi().getUsername());
        userDto.setFullName(visit.getAshaKarmi().getFullName());
        this.ashaKarmi = userDto;

        if (visit.getMedicalRecord() != null) {
            MedicalRecordDto medicalRecordDto = new MedicalRecordDto();
            medicalRecordDto.setId(visit.getMedicalRecord().getId());
            medicalRecordDto.setRawTranscript(visit.getMedicalRecord().getRawTranscript());
            medicalRecordDto.setStructuredData(visit.getMedicalRecord().getStructuredData());
            medicalRecordDto.setCreatedAt(visit.getMedicalRecord().getCreatedAt());
            this.medicalRecord = medicalRecordDto;
        }
    }
}
