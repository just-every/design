import { chromium } from 'playwright';

async function testSimpleImageSearch() {
    console.log('🔍 Testing simple image search...');

    const browser = await chromium.launch({ headless: true }); 
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    try {
        // Let's try Unsplash which should be more accessible
        const query = "logo design";
        const url = `https://unsplash.com/s/photos/${encodeURIComponent(query)}`;
        console.log(`Testing Unsplash: ${url}`);
        
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });
        
        await page.waitForTimeout(3000);
        
        const title = await page.title();
        console.log(`Page title: ${title}`);
        
        const images = await page.evaluate(() => {
            const imgs = document.querySelectorAll('img');
            return Array.from(imgs).slice(0, 5).map(img => ({
                src: img.src,
                alt: img.alt,
                parent: img.closest('a')?.getAttribute('href')
            })).filter(img => img.src && !img.src.includes('data:image'));
        });
        
        console.log(`Found ${images.length} images on Unsplash`);
        images.forEach((img, i) => {
            console.log(`${i + 1}. ${img.alt} - ${img.src.substring(0, 80)}...`);
        });
        
        // Now let's try to understand the structure and extract proper links
        const links = await page.evaluate(() => {
            const links = document.querySelectorAll('a[href*="/photos/"]');
            return Array.from(links).slice(0, 5).map(link => ({
                href: (link as HTMLAnchorElement).href,
                text: link.textContent?.trim() || '',
                hasImage: !!link.querySelector('img')
            }));
        });
        
        console.log(`Found ${links.length} photo links`);
        links.forEach((link, i) => {
            console.log(`${i + 1}. ${link.href} (has image: ${link.hasImage})`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

testSimpleImageSearch().catch(console.error);