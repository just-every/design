import { design_search } from './src/design-search.js';

async function testVecteezy() {
    console.log('🧪 Testing Vecteezy search engine...\n');
    
    try {
        const result = await design_search('vecteezy', 'logo design', 3);
        const results = JSON.parse(result);
        
        console.log(`✅ Vecteezy: Found ${results.length} results`);
        
        results.forEach((result: any, i: number) => {
            console.log(`${i + 1}. ${result.title}`);
            console.log(`   URL: ${result.url}`);
            console.log(`   Thumbnail: ${result.thumbnailURL ? 'Yes' : 'No'}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testVecteezy().catch(console.error);