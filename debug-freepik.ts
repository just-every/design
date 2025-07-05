import { chromium } from 'playwright';

async function debugFreepik() {
    console.log('🔍 Debugging Freepik page structure...');

    const browser = await chromium.launch({ 
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    }); 
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    try {
        const query = "logo design";
        const url = `https://www.freepik.com/search?format=search&query=${encodeURIComponent(query)}`;
        console.log(`Navigating to: ${url}`);
        
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        await page.waitForTimeout(5000);
        
        // Try to wait for images
        try {
            await page.waitForSelector('img', { timeout: 10000 });
        } catch (e) {
            console.log('No img elements found within timeout');
        }
        
        const title = await page.title();
        const currentUrl = page.url();
        console.log(`Page title: ${title}`);
        console.log(`Current URL: ${currentUrl}`);
        
        const containerInfo = await page.evaluate(() => {
            const info: any = {};
            
            const selectors = [
                'figure a[href*="/free-"]',
                'a[data-track-ga="resource-preview"]',
                'figure a',
                'a[href*="/premium-"]',
                'figure',
                'img',
                'a'
            ];
            
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                info[selector] = elements.length;
            }
            
            info.bodyClasses = document.body.className;
            info.hasContent = document.body.innerText.length > 1000;
            
            return info;
        });
        
        console.log('Container analysis:', containerInfo);
        
        // Check first few images
        const sampleImages = await page.evaluate(() => {
            const images = document.querySelectorAll('img');
            return Array.from(images).slice(0, 5).map(img => ({
                src: img.src,
                alt: img.alt,
                parentHref: img.closest('a')?.getAttribute('href')
            }));
        });
        
        console.log('Sample images:', sampleImages);
        
        // Get page structure
        const pageStructure = await page.evaluate(() => {
            return {
                bodyTextLength: document.body.innerText.length,
                bodyTextSample: document.body.innerText.substring(0, 200),
                divCount: document.querySelectorAll('div').length,
                imageCount: document.querySelectorAll('img').length,
                linkCount: document.querySelectorAll('a').length,
                figureCount: document.querySelectorAll('figure').length
            };
        });
        
        console.log('Page structure:', pageStructure);
        
        console.log('✅ Debug complete');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

debugFreepik().catch(console.error);