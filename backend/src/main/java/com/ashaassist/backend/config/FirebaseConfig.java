package com.ashaassist.backend.config;

import java.io.IOException;
import java.io.InputStream;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

import jakarta.annotation.PostConstruct;

/**
 * Configures and initializes the Firebase Admin SDK upon application startup.
 */
@Configuration
public class FirebaseConfig {

    /**
     * Initializes the Firebase Admin SDK using credentials from {@code serviceAccountKey.json}.
     * This method is executed after the bean has been constructed.
     */
    @PostConstruct
    public void initialize() {
        try {
            InputStream serviceAccount = new ClassPathResource(
                "serviceAccountKey.json"
            ).getInputStream();

            FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                .build();

            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseApp.initializeApp(options);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
