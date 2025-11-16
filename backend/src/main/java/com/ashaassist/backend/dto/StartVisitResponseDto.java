package com.ashaassist.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data Transfer Object for the response when starting a new visit.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StartVisitResponseDto {

    private Long visitId;

    /**
     * Sets the ID of the visit.
     *
     * @param id the visit ID.
     */
    public void setId(Long id) {
        this.visitId = id;
    }
}
