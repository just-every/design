/**
 * Test the design agent with proper logging
 */

import { config } from 'dotenv';
import { createDesignAgent } from './src/agents/design-agent.js';
import { runMECH } from './src/interfaces/mech.js';
import path from 'path';
import fs from 'fs';

// Load environment variables
config();

async function testDesignAgent() {
    console.log('=== TESTING DESIGN AGENT ===\n');
    
    // Test with a simple logo request
    const userPrompt = 'Create a logo for a coffee shop called "Bean & Brew" that specializes in artisan coffee';
    
    console.log(`User prompt: ${userPrompt}\n`);
    
    try {
        // Create the design agent
        const agent = createDesignAgent(
            userPrompt,
            'primary_logo', // Specify the asset type
            true // with inspiration
        );
        
        console.log('Agent created successfully\n');
        
        // Run the agent
        console.log('Running agent...\n');
        const response = await runMECH(agent, userPrompt);
        
        console.log('\n=== AGENT RESPONSE ===');
        console.log(response);
        
        // Check what files were created
        const outputDirs = fs.readdirSync(path.join(process.cwd(), '.output'));
        console.log('\n=== OUTPUT DIRECTORIES ===');
        console.log(outputDirs.filter(d => !d.startsWith('.')));
        
    } catch (error) {
        console.error('\n=== ERROR ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testDesignAgent().catch(console.error);