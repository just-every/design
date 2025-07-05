import { design_search } from './src/design-search.js';

async function testBraveImages() {
    console.log('🧪 Testing Brave Images search engine...\n');
    
    try {
        const result = await design_search('brave_images', 'logo design', 3);
        const results = JSON.parse(result);
        
        console.log(`✅ Brave Images: Found ${results.length} results`);
        
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

testBraveImages().catch(console.error);