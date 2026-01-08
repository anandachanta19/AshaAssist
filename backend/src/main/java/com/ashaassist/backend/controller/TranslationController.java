// in package com.ashaassist.backend.controller;

package com.ashaassist.backend.controller;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.google.cloud.translate.v3.DetectLanguageRequest;
import com.google.cloud.translate.v3.DetectLanguageResponse;
import com.google.cloud.translate.v3.LocationName;
import com.google.cloud.translate.v3.TranslateTextRequest;
import com.google.cloud.translate.v3.TranslateTextResponse;
import com.google.cloud.translate.v3.TranslationServiceClient;

/**
 * DTO to receive the text payload for translation.
 */
class TranslatePayload {
    private String text;

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }
}

/**
 * Controller for handling text translation requests using Google Cloud
 * Translation API.
 */
@RestController
@RequestMapping("/api")
public class TranslationController {

    @Value("${google.project.id}")
    private String projectId;

    /**
     * Translates the provided text to English.
     * Automatically detects the source language.
     * 
     * @param payload The payload containing the text to translate.
     * @return The translated text in English, or the original text if it's already
     *         in English.
     */
    @PostMapping("/translate")
    public ResponseEntity<String> translateText(@RequestBody TranslatePayload payload) {

        String textToTranslate = payload.getText();

        try (TranslationServiceClient client = TranslationServiceClient.create()) {
            LocationName parent = LocationName.of(projectId, "global");

            // --- NEW: 1. Detect the language first ---
            DetectLanguageRequest detectRequest = DetectLanguageRequest.newBuilder()
                    .setParent(parent.toString())
                    .setMimeType("text/plain")
                    .setContent(textToTranslate)
                    .build();

            DetectLanguageResponse detectResponse = client.detectLanguage(detectRequest);
            // Get the language with the highest confidence
            String detectedLanguageCode = detectResponse.getLanguages(0).getLanguageCode();

            // --- NEW: 2. Check if it's already English ---
            if (detectedLanguageCode.equalsIgnoreCase("en")) {
                // It's already English, just return the original text
                return ResponseEntity.ok(textToTranslate);
            }

            // --- 3. If not English, then translate it ---
            TranslateTextRequest translateRequest = TranslateTextRequest.newBuilder()
                    .setParent(parent.toString())
                    .setMimeType("text/plain")
                    .setSourceLanguageCode(detectedLanguageCode) // Use the language we detected
                    .setTargetLanguageCode("en-US") // Translate to English
                    .addContents(textToTranslate)
                    .build();

            TranslateTextResponse translateResponse = client.translateText(translateRequest);
            String translatedText = translateResponse.getTranslations(0).getTranslatedText();

            return ResponseEntity.ok(translatedText);

        } catch (IOException e) {
            System.err.println("Translation error: " + e.getMessage());
            return ResponseEntity.status(500).body("Error translating text");
        }
    }
}