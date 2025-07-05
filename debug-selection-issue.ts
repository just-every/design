/**
 * Debug the selection issue with detailed logging
 */

import { config } from 'dotenv';
import { smart_design_raw } from './src/design-search.js';
import fs from 'fs';
import path from 'path';

// Load environment variables
config();

async function debugSelectionIssue() {
    console.log('=== DEBUGGING SELECTION ISSUE ===\n');
    
    // Simple test case
    const outputDir = path.join(process.cwd(), '.output', 'debug-selection');
    process.env.DESIGN_OUTPUT_DIR = outputDir;
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log(`Output directory: ${outputDir}\n`);
    
    // Test with simple coffee shop search
    const searchConfigs = [
        { engine: 'dribbble' as const, query: 'coffee logo', limit: 4 },
        { engine: 'behance' as const, query: 'cafe branding', limit: 4 }
    ];
    
    const context = 'Coffee shop logo test';
    
    try {
        console.log('Running smart_design_raw...\n');
        const results = await smart_design_raw(
            context,
            searchConfigs,
            3, // finalLimit
            'primary_logo',
            'Select coffee-related designs',
            'debug'
        );
        
        console.log(`\n=== FINAL RESULTS ===`);
        console.log(`Found ${results.length} final designs`);
        
        results.forEach((design, i) => {
            console.log(`${i + 1}. ${design.title?.substring(0, 60)}...`);
        });
        
        // Save results
        const resultsPath = path.join(outputDir, 'debug_results.json');
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf-8');
        console.log(`\nResults saved to: ${resultsPath}`);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugSelectionIssue().catch(console.error);