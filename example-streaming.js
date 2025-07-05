/**
 * Example of using the streaming design agent API
 */

import { runDesignAgentStreaming, DESIGN_ASSET_TYPES } from './dist/index.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function main() {
    console.log('Starting design generation with streaming...\n');

    try {
        // Run the design agent with streaming
        const generator = runDesignAgentStreaming(
            DESIGN_ASSET_TYPES.LOGO,
            'Create a modern logo for a tech startup called "StreamFlow"',
            true // with inspiration
        );

        let finalPath;
        
        // Process the stream of events
        for await (const event of generator) {
            // Log different event types
            switch (event.type) {
                case 'message_delta':
                    if ('content' in event && event.content) {
                        process.stdout.write(event.content);
                    }
                    break;
                    
                case 'message_complete':
                    console.log('\n[Message Complete]');
                    break;
                    
                case 'tool_start':
                    if ('tool_call' in event) {
                        const toolCall = event.tool_call as any;
                        console.log(`\n[Tool Start] ${toolCall?.function?.name || 'unknown'}`);
                    }
                    break;
                    
                case 'tool_done':
                    if ('tool_call' in event) {
                        const toolCall = event.tool_call as any;
                        console.log(`[Tool Done] ${toolCall?.function?.name || 'unknown'}\n`);
                    }
                    break;
                    
                case 'error':
                    console.error('\n[Error]', event);
                    break;
                    
                case 'stream_end':
                    console.log('\n[Stream End]');
                    break;
            }
        }

        // The generator returns the final path when done
        finalPath = generator.return?.value;
        console.log('\nFinal image path:', finalPath);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

main();