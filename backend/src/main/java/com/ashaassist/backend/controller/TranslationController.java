// in package com.ashaassist.backend.controller;

package com.ashaassist.backend.controller;

import java.io.IOException;

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

// DTO to receive the text from the frontend
// --- MODIFIED: We no longer need source/target language from the client ---
class TranslatePayload {
    private String text;

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }
}

@RestController
@RequestMapping("/api")
public class TranslationController {

    @PostMapping("/translate")
    public ResponseEntity<String> translateText(@RequestBody TranslatePayload payload) {

        // --- FIX: Add your REAL Project ID ---
        String projectId = "asha-assist-8c5be"; // <-- REPLACE THIS
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