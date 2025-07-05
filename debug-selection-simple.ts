/**
 * Simpler debug test
 */

import { config } from 'dotenv';
import { smart_design_raw } from './src/design-search.js';
import fs from 'fs';
import path from 'path';

config();

async function simpleDebug() {
    const outputDir = path.join(process.cwd(), '.output', 'simple-debug');
    process.env.DESIGN_OUTPUT_DIR = outputDir;
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    try {
        const results = await smart_design_raw(
            'Simple coffee test',
            [{ engine: 'dribbble' as const, query: 'coffee', limit: 3 }],
            2, // finalLimit
            'primary_logo',
            'Select coffee designs',
            'simple'
        );
        
        console.log(`\nFINAL: ${results.length} results`);
        console.log('SUCCESS!');
        
    } catch (error) {
        console.error('ERROR:', error.message);
        console.error('Stack:', error.stack);
    }
}

simpleDebug().catch(console.error);