/**
 * Run the design agent with proper configuration
 */

import { config } from 'dotenv';
import { createDesignAgent } from './src/agents/design-agent.js';
import { runMECH } from './src/interfaces/mech.js';

// Load environment variables
config();

async function runDesignAgent() {
    const userPrompt = process.argv[2] || 'Create a modern logo for a coffee shop called Bean & Brew';
    const assetType = (process.argv[3] || 'primary_logo') as any;
    const withInspiration = process.argv[4] !== 'false';
    
    console.log('=== DESIGN AGENT ===');
    console.log(`Prompt: ${userPrompt}`);
    console.log(`Asset Type: ${assetType}`);
    console.log(`With Inspiration: ${withInspiration}`);
    console.log('');
    
    try {
        // Create the design agent
        const agent = createDesignAgent(userPrompt, assetType, withInspiration);
        
        // Run the agent
        console.log('Starting agent...\n');
        const response = await runMECH(agent, userPrompt);
        
        console.log('\n=== COMPLETED ===');
        console.log(response);
        
    } catch (error) {
        console.error('\n=== ERROR ===');
        console.error(error);
    }
}

runDesignAgent().catch(console.error);