/**
 * Debug multi-round selection
 */

import { config } from 'dotenv';
import { smart_design_raw } from './src/design-search.js';
import fs from 'fs';
import path from 'path';

config();

async function multiRoundDebug() {
    const outputDir = path.join(process.cwd(), '.output', 'multi-round-debug');
    process.env.DESIGN_OUTPUT_DIR = outputDir;
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    try {
        // Force multiple rounds by having more designs than finalLimit
        const results = await smart_design_raw(
            'Coffee shop test',
            [
                { engine: 'dribbble' as const, query: 'coffee', limit: 5 },
                { engine: 'behance' as const, query: 'cafe', limit: 5 }
            ],
            3, // finalLimit - this should trigger multiple rounds
            'primary_logo',
            'Select coffee designs',
            'multiround'
        );
        
        console.log(`\nFINAL: ${results.length} results`);
        results.forEach((r, i) => {
            console.log(`${i + 1}. ${r.title?.substring(0, 50)}...`);
        });
        
    } catch (error) {
        console.error('ERROR:', error.message);
        console.error('Stack:', error.stack?.substring(0, 500));
    }
}

multiRoundDebug().catch(console.error);