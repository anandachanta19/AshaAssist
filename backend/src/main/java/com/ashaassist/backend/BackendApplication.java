package com.ashaassist.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * The main entry point for the Asha Assist backend application.
 * This class initializes and runs the Spring Boot application.
 */
@SpringBootApplication
public class BackendApplication {

	/**
	 * The main method that starts the Spring Boot application.
	 * @param args Command line arguments passed to the application.
	 */
	public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}

}
