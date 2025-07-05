import { chromium } from 'playwright';

async function debugShutterstock() {
    console.log('🔍 Debugging Shutterstock page structure...');

    const browser = await chromium.launch({ 
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }); 
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    try {
        const query = "logo design";
        // Try the correct Shutterstock search URL format
        const url = `https://www.shutterstock.com/search/${encodeURIComponent(query)}`;
        console.log(`Navigating to: ${url}`);
        
        // Also test alternative URL format
        const altUrl = `https://www.shutterstock.com/search?searchterm=${encodeURIComponent(query)}`;
        console.log(`Alternative URL: ${altUrl}`);
        
        // Try the alternative URL first
        await page.goto(altUrl, {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        // Wait longer for dynamic content
        await page.waitForTimeout(8000);
        
        // Try to wait for common content selectors
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
                '[data-automation="mosaic-grid"] a',
                'a[data-track-action="preview"]',
                'a[href*="/image-photo/"]',
                'a[href*="/image-vector/"]',
                'a[href*="/image"]',
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
        
        // Get more detailed page structure
        const pageStructure = await page.evaluate(() => {
            return {
                bodyTextLength: document.body.innerText.length,
                bodyTextSample: document.body.innerText.substring(0, 500),
                divCount: document.querySelectorAll('div').length,
                imageCount: document.querySelectorAll('img').length,
                linkCount: document.querySelectorAll('a').length,
                hasSearchResults: !!document.querySelector('[data-testid], [class*="search"], [class*="result"], [class*="grid"], [class*="image"]'),
                mainContentSelectors: [
                    'main',
                    '[role="main"]', 
                    '[class*="search"]',
                    '[class*="result"]',
                    '[class*="grid"]',
                    '[class*="image"]'
                ].map(sel => ({
                    selector: sel,
                    count: document.querySelectorAll(sel).length
                }))
            };
        });
        
        console.log('Page structure:', pageStructure);
        
        const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
        
        if (bodyText.includes('sign in') || bodyText.includes('login') || bodyText.includes('blocked')) {
            console.log('⚠️ Possible authentication required or blocked');
        }
        
        console.log('✅ Debug complete');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

debugShutterstock().catch(console.error);