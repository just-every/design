#!/usr/bin/env tsx

/**
 * List all available tools in the Design Agent
 */

import { createDesignAgent } from './src/agents/design-agent.js';

// Create a sample agent to inspect its tools
const agent = createDesignAgent('sample prompt', 'primary_logo', true);

console.log('=== Design Agent Tools ===\n');

agent.tools.forEach((tool, index) => {
    const toolName = tool.function?.name || tool.name || 'Anonymous Tool';
    const toolDesc = tool.function?.description || tool.description || 'No description';
    const toolParams = tool.function?.parameters?.properties || tool.parameters?.properties || {};
    
    console.log(`${index + 1}. ${toolName}`);
    console.log(`   Description: ${toolDesc}`);
    console.log(`   Parameters:`, Object.keys(toolParams).join(', ') || 'None');
    console.log('');
});

console.log(`Total tools available: ${agent.tools.length}`);