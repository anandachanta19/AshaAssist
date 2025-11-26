package com.ashaassist.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configures Cross-Origin Resource Sharing (CORS) for the application.
 * This class ensures that the backend allows requests from the React frontend.
 */
@Configuration
public class CorsConfig {

    /**
     * Defines the CORS configuration for the application.
     *
     * @return a {@link WebMvcConfigurer} with CORS settings.
     */
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry
                        .addMapping("/api/**") // Apply to all API endpoints
                        .allowedOrigins("http://localhost:5173") // Allow the React dev server
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS") // Allowed HTTP methods
                        .allowedHeaders("*") // Allow all headers
                        .allowCredentials(true);
                // mg
            }
        };
    }
}
