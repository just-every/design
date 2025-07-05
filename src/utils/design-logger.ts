/**
 * Design-specific logger that logs to the design output directory
 */

import { initializeLLMLogger } from './logger.js';

/**
 * Initialize logger for a specific design session
 * @param designDir The design output directory
 */
export function initializeDesignLogger(_designDir: string) {
    // The DESIGN_OUTPUT_DIR should already be set by setDesign
    // Just initialize the logger which will use the current DESIGN_OUTPUT_DIR
    initializeLLMLogger();
}