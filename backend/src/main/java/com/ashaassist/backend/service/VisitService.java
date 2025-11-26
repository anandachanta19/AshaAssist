package com.ashaassist.backend.service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.ashaassist.backend.dto.StartVisitRequestDto;
import com.ashaassist.backend.dto.TranscriptionResponseDto;
import com.ashaassist.backend.dto.VerifyOtpRequestDto;
import com.ashaassist.backend.dto.VisitDto;
import com.ashaassist.backend.model.MedicalRecord;
import com.ashaassist.backend.model.Patient;
import com.ashaassist.backend.model.User;
import com.ashaassist.backend.model.Visit;
import com.ashaassist.backend.repository.MedicalRecordRepository;
import com.ashaassist.backend.repository.PatientRepository;
import com.ashaassist.backend.repository.UserRepository;
import com.ashaassist.backend.repository.VisitRepository;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;

import jakarta.annotation.PostConstruct;

@Service
public class VisitService {

    private final UserRepository userRepository;
    private final PatientRepository patientRepository;
    private final VisitRepository visitRepository;
    private final MedicalRecordRepository medicalRecordRepository;

    @Value("${whisper.api.url}")
    private String whisperApiUrl;

    @Value("${ai.service.url}")
    private String aiServiceUrl;

    @Value("${twilio.account-sid}")
    private String twilioAccountSid;

    @Value("${twilio.auth-token}")
    private String twilioAuthToken;

    @Value("${twilio.phone-number}")
    private String twilioPhoneNumber;

    public VisitService(
            UserRepository userRepository,
            PatientRepository patientRepository,
            VisitRepository visitRepository,
            MedicalRecordRepository medicalRecordRepository) {
        this.userRepository = userRepository;
        this.patientRepository = patientRepository;
        this.visitRepository = visitRepository;
        this.medicalRecordRepository = medicalRecordRepository;
    }

    @PostConstruct
    public void initTwilio() {
        Twilio.init(twilioAccountSid, twilioAuthToken);
    }

    public Visit startVisit(StartVisitRequestDto startVisitRequestDto) {
        String username = SecurityContextHolder.getContext()
                .getAuthentication()
                .getName();
        User currentUser = userRepository
                .findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Patient patient = patientRepository
                .findByPhoneNumber(startVisitRequestDto.getPatientPhoneNumber())
                .orElseGet(() -> {
                    if (startVisitRequestDto.getFullName() == null || startVisitRequestDto.getFullName().isEmpty()) {
                        throw new IllegalArgumentException("Full name is required for a new patient.");
                    }
                    Patient newPatient = new Patient();
                    newPatient.setPhoneNumber(startVisitRequestDto.getPatientPhoneNumber());
                    newPatient.setFullName(startVisitRequestDto.getFullName());
                    newPatient.setDateOfBirth(startVisitRequestDto.getDateOfBirth());
                    newPatient.setGender(startVisitRequestDto.getGender());
                    newPatient.setAddress(startVisitRequestDto.getAddress());
                    return patientRepository.save(newPatient);
                });

        String otp = String.format("%06d", new Random().nextInt(999999));

        try {
            Message.creator(
                    new com.twilio.type.PhoneNumber(startVisitRequestDto.getPatientPhoneNumber()),
                    new com.twilio.type.PhoneNumber(twilioPhoneNumber),
                    "Your Asha Assist verification code is: " + otp).create();
        } catch (Exception e) {
            throw new RuntimeException("Failed to send OTP SMS. Please check phone number and Twilio configuration.");
        }

        Visit visit = new Visit();
        visit.setAshaKarmi(currentUser);
        visit.setPatient(patient);
        visit.setOtpCode(otp);
        visit.setOtpExpiresAt(LocalDateTime.now().plusMinutes(5));

        return visitRepository.save(visit);
    }

    public boolean verifyOtp(VerifyOtpRequestDto verifyOtpRequestDto) {
        Visit visit = visitRepository
                .findById(verifyOtpRequestDto.getVisitId())
                .orElseThrow(() -> new RuntimeException("Visit not found"));

        if (visit.getOtpCode().equals(verifyOtpRequestDto.getOtp()) &&
                visit.getOtpExpiresAt().isAfter(LocalDateTime.now())) {
            visit.setVerified(true);
            visit.setVerifiedAt(LocalDateTime.now());
            visitRepository.save(visit);
            return true;
        }
        return false;
    }

    @Transactional(readOnly = true)
    public List<VisitDto> findVisitsForCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Visit> visits = visitRepository.findTop5ByAshaKarmiOrderByCreatedAtDesc(currentUser);

        return visits.stream().map(VisitDto::new).collect(Collectors.toList());
    }

    public TranscriptionResponseDto transcribeAudio(Long visitId, MultipartFile audioFile) throws IOException {
        Visit visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new RuntimeException("Visit not found with ID: " + visitId));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        ByteArrayResource fileResource = new ByteArrayResource(audioFile.getBytes()) {
            @Override
            public String getFilename() {
                return audioFile.getOriginalFilename();
            }
        };
        body.add("file", fileResource);

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        RestTemplate restTemplate = new RestTemplate();
        ResponseEntity<String> response = restTemplate.postForEntity(whisperApiUrl, requestEntity, String.class);

        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("Whisper API returned an error: " + response.getStatusCode());
        }

        String transcript = response.getBody();
        String transcriptText;

        try {
            JSONObject transcriptJson = new JSONObject(transcript);
            transcriptText = transcriptJson.getString("transcription");
        } catch (Exception e) {
            System.err.println("Whisper response was not valid JSON: " + transcript);
            throw new RuntimeException("Failed to parse Whisper API response.", e);
        }

        MedicalRecord medicalRecord = visit.getMedicalRecord();
        if (medicalRecord == null) {
            medicalRecord = new MedicalRecord();
            medicalRecord.setVisit(visit);
        }
        medicalRecord.setRawTranscript(transcript);
        medicalRecordRepository.save(medicalRecord);

        try {
            HttpHeaders indexHeaders = new HttpHeaders();
            indexHeaders.setContentType(MediaType.APPLICATION_JSON);

            JSONObject requestBodyJson = new JSONObject();
            requestBodyJson.put("visitId", visitId);
            requestBodyJson.put("transcript", transcriptText);

            HttpEntity<String> indexRequest = new HttpEntity<>(requestBodyJson.toString(), indexHeaders);

            restTemplate.postForEntity(aiServiceUrl + "/index", indexRequest, String.class);
            System.out.println("---- Successfully triggered indexing for Visit ID: " + visitId + " ----");
        } catch (Exception e) {
            System.err.println("Error triggering indexing: " + e.getMessage());
        }

        return new TranscriptionResponseDto(medicalRecord.getId(), transcript);
    }

    @Transactional(readOnly = true)
    public VisitDto findVisitById(Long visitId) {
        // 1. Get the current authentication
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String currentUsername = authentication.getName();

        // 2. Check if the user has ADMIN authority
        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ADMIN"));

        // 3. Find the visit
        Visit visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new RuntimeException("Visit not found"));

        // 4. Validation Logic: Allow access if user is the owner OR if user is an ADMIN
        if (!visit.getAshaKarmi().getUsername().equals(currentUsername) && !isAdmin) {
            throw new AccessDeniedException("You are not authorized to view this visit.");
        }

        return new VisitDto(visit);
    }
}