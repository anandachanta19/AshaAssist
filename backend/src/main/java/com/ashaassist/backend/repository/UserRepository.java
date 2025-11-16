package com.ashaassist.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ashaassist.backend.model.User;

/**
 * Repository interface for {@link User} entities.
 * Provides standard CRUD operations and a custom method to find a user by username.
 */
public interface UserRepository extends JpaRepository<User, Long>{
    /**
     * Finds a user by their username.
     *
     * @param username the username to search for.
     * @return an {@link Optional} containing the user if found, or empty otherwise.
     */
    Optional<User> findByUsername(String username);
}
