// Test the web search functionality directly
import { web_search } from '@just-every/search';

async function testWebSearch() {
    console.log('🧪 Testing web search engines...\n');
    
    const engines = ['brave-images', 'anthropic', 'openai'];
    
    for (const engine of engines) {
        console.log(`Testing ${engine}...`);
        try {
            const result = await web_search('test-agent', engine, 'logo design examples', 3);
            console.log(`✅ ${engine}: ${result.length > 0 ? 'Success' : 'No results'}`);
            if (result.length > 100) {
                console.log(`   Response: ${result.substring(0, 100)}...`);
            } else {
                console.log(`   Response: ${result}`);
            }
        } catch (error) {
            console.log(`❌ ${engine}: ${error instanceof Error ? error.message : String(error)}`);
        }
        console.log('');
    }
}

testWebSearch().catch(console.error);