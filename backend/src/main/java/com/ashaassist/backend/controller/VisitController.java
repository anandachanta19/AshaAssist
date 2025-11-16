package com.ashaassist.backend.controller;

import java.io.IOException;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.ashaassist.backend.dto.StartVisitRequestDto;
import com.ashaassist.backend.dto.StartVisitResponseDto;
import com.ashaassist.backend.dto.TranscriptionResponseDto;
import com.ashaassist.backend.dto.VerifyOtpRequestDto;
import com.ashaassist.backend.dto.VisitDto;
import com.ashaassist.backend.model.Visit;
import com.ashaassist.backend.service.VisitService;

/**
 * Controller for handling visit-related requests, such as starting, verifying, and transcribing visits.
 */
@RestController
@RequestMapping("/api/visits")
public class VisitController {

    private final VisitService visitService;

    /**
     * Constructs a new {@code VisitController} with the specified visit service.
     *
     * @param visitService the service to use for visit operations.
     */
    public VisitController(VisitService visitService) {
        this.visitService = visitService;
    }

    /**
     * Starts a new visit for a patient.
     *
     * @param startVisitRequestDto the data transfer object containing information to start a visit.
     * @return a {@link ResponseEntity} with a response DTO containing the new visit's ID and HTTP status 200 (OK).
     */
    @PostMapping("/start")
    public ResponseEntity<StartVisitResponseDto> startVisit(
        @RequestBody StartVisitRequestDto startVisitRequestDto
    ) {
        Visit newVisit = visitService.startVisit(startVisitRequestDto);
        StartVisitResponseDto responseDto = new StartVisitResponseDto();
        responseDto.setId(newVisit.getId());
        return ResponseEntity.ok(responseDto);
    }

    /**
     * Verifies a visit using an OTP.
     *
     * @param verifyOtpRequestDto the data transfer object containing the visit ID and OTP.
     * @return a {@link ResponseEntity} with a success or failure message and an appropriate HTTP status.
     */
    @PostMapping("/verify")
    public ResponseEntity<String> verifyOtp(
        @RequestBody VerifyOtpRequestDto verifyOtpRequestDto
    ) {
        boolean isVerified = visitService.verifyOtp(verifyOtpRequestDto);
        if (isVerified) {
            return ResponseEntity.ok("Visit verified successfully.");
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                "Invalid or expired OTP."
            );
        }
    }

    /**
     * Retrieves a visit by its ID.
     *
     * @param id the ID of the visit to retrieve.
     * @return a {@link ResponseEntity} with the visit data transfer object and HTTP status 200 (OK).
     */
    @GetMapping("/{id}")
    public ResponseEntity<VisitDto> getVisitById(@PathVariable Long id) {
        VisitDto visitDto = visitService.findVisitById(id);
        return ResponseEntity.ok(visitDto);
    }

    /**
     * Uploads an audio file for a visit and transcribes it.
     *
     * @param visitId   the ID of the visit.
     * @param audioFile the audio file to transcribe.
     * @return a {@link ResponseEntity} with the transcription response or an error message.
     */
    @PostMapping("/{id}/transcribe")
    public ResponseEntity<?> uploadAndTranscribeAudio(
        @PathVariable("id") Long visitId,
        @RequestParam("audioFile") MultipartFile audioFile
    ) {
        if (audioFile.isEmpty()) {
            return ResponseEntity.badRequest().body(
                "Please upload an audio file."
            );
        }

        try {
            TranscriptionResponseDto response = visitService.transcribeAudio(
                visitId,
                audioFile
            );
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                "Failed to process file: " + e.getMessage()
            );
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                e.getMessage()
            );
        }
    }

    /**
     * Retrieves the recent visits for the currently logged-in user.
     *
     * @return a {@link ResponseEntity} with a list of visit data transfer objects and HTTP status 200 (OK).
     */
    @GetMapping("/my-recent")
    public ResponseEntity<List<VisitDto>> getMyRecentVisits() {
        List<VisitDto> visitDtos = visitService.findVisitsForCurrentUser();
        return ResponseEntity.ok(visitDtos);
    }
}
