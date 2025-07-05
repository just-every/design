/**
 * Test the fixed design agent
 */

import { config } from 'dotenv';
import { createDesignAgent } from './src/agents/design-agent.js';
import { runMECH } from './src/interfaces/mech.js';
import path from 'path';
import fs from 'fs';

// Load environment variables
config();

async function testFixedAgent() {
    console.log('=== TESTING FIXED DESIGN AGENT ===\n');
    
    // Clear any existing test output directory
    const testOutputDir = path.join(process.cwd(), '.output', 'test-fixed-agent');
    if (fs.existsSync(testOutputDir)) {
        fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
    
    const userPrompt = 'Create a modern logo for TechFlow, an AI-powered workflow automation startup';
    
    console.log(`User prompt: ${userPrompt}\n`);
    
    try {
        // Create the design agent
        const agent = createDesignAgent(
            userPrompt,
            'primary_logo',
            true // with inspiration
        );
        
        console.log('Starting agent...\n');
        
        // Run just the inspiration phase
        const messages = [
            {
                type: 'message' as const,
                role: 'user' as const,
                content: userPrompt
            }
        ];
        
        // Use the agent to handle just the inspiration phase
        const tools = agent.tools || [];
        console.log('Available tools:', tools.map(t => t.name).join(', '));
        
        // Run the agent with a simple request
        const response = await runMECH(agent, userPrompt, {
            maxTurns: 3 // Limit turns to prevent timeout
        });
        
        console.log('\n=== RESULT ===');
        console.log(response);
        
    } catch (error) {
        console.error('\n=== ERROR ===');
        console.error(error.message);
    }
}

testFixedAgent().catch(console.error);