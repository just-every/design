#!/usr/bin/env npx tsx

import { chromium } from 'playwright';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function debugFreepikImages() {
    console.log('🔍 Debugging Freepik image extraction...\n');
    
    const browser = await chromium.launch({ 
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });
    
    const context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        extraHTTPHeaders: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        }
    });
    
    const page = await context.newPage();
    
    // Remove navigator.webdriver property
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
    });
    
    const url = 'https://www.freepik.com/search?format=search&query=logo%20design';
    console.log(`Navigating to: ${url}\n`);
    
    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        
        // Wait for content
        await page.waitForTimeout(5000);
        
        // Try to wait for images to load
        try {
            await page.waitForSelector('figure img', { timeout: 5000 });
            console.log('✅ Found figure img elements\n');
        } catch {
            console.log('❌ No figure img elements found\n');
        }
        
        // Debug the page structure
        const pageInfo = await page.evaluate(() => {
            const info: any = {};
            
            // Check figures
            const figures = document.querySelectorAll('figure');
            info.figureCount = figures.length;
            
            // Check links in figures
            const figureLinks = document.querySelectorAll('figure a[href*="/free-"], figure a[href*="/premium-"]');
            info.figureLinkCount = figureLinks.length;
            
            // Check all images
            const allImages = document.querySelectorAll('img');
            info.totalImageCount = allImages.length;
            
            // Check images in figures
            const figureImages = document.querySelectorAll('figure img');
            info.figureImageCount = figureImages.length;
            
            // Get first few figure structures
            info.firstFigures = [];
            for (let i = 0; i < Math.min(3, figures.length); i++) {
                const figure = figures[i];
                const figureInfo: any = {
                    innerHTML: figure.innerHTML.substring(0, 500),
                    hasLink: !!figure.querySelector('a'),
                    linkHref: figure.querySelector('a')?.getAttribute('href'),
                    hasImg: !!figure.querySelector('img'),
                    imgSrc: figure.querySelector('img')?.getAttribute('src'),
                    imgDataSrc: figure.querySelector('img')?.getAttribute('data-src'),
                    dataAttributes: Array.from(figure.attributes)
                        .filter(attr => attr.name.startsWith('data-'))
                        .map(attr => `${attr.name}="${attr.value}"`)
                };
                info.firstFigures.push(figureInfo);
            }
            
            // Try to find images with different approaches
            info.imagesBySelector = {};
            const selectors = [
                'img[src*="img.freepik.com"]',
                'img[data-src]',
                '[data-cy="resource-thumbnail"] img',
                'div[style*="background-image"]'
            ];
            
            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                info.imagesBySelector[selector] = elements.length;
            });
            
            return info;
        });
        
        console.log('Page structure analysis:');
        console.log(`- Total figures: ${pageInfo.figureCount}`);
        console.log(`- Figure links: ${pageInfo.figureLinkCount}`);
        console.log(`- Total images: ${pageInfo.totalImageCount}`);
        console.log(`- Images in figures: ${pageInfo.figureImageCount}`);
        console.log('');
        
        console.log('Images by selector:');
        Object.entries(pageInfo.imagesBySelector).forEach(([selector, count]) => {
            console.log(`- ${selector}: ${count}`);
        });
        console.log('');
        
        console.log('First 3 figure structures:');
        pageInfo.firstFigures.forEach((fig: any, i: number) => {
            console.log(`\nFigure ${i + 1}:`);
            console.log(`- Has link: ${fig.hasLink}`);
            console.log(`- Link href: ${fig.linkHref || 'none'}`);
            console.log(`- Has img: ${fig.hasImg}`);
            console.log(`- Img src: ${fig.imgSrc || 'none'}`);
            console.log(`- Img data-src: ${fig.imgDataSrc || 'none'}`);
            console.log(`- Data attributes: ${fig.dataAttributes.join(', ') || 'none'}`);
            console.log(`- HTML preview: ${fig.innerHTML.substring(0, 200)}...`);
        });
        
        // Try to extract images with the actual logic
        const extractedImages = await page.evaluate(() => {
            const images: any[] = [];
            const figureLinks = document.querySelectorAll('figure a[href*="/free-"], figure a[href*="/premium-"]');
            
            for (let i = 0; i < Math.min(figureLinks.length, 3); i++) {
                const linkElement = figureLinks[i] as HTMLAnchorElement;
                const url = linkElement.href;
                const figure = linkElement.closest('figure');
                
                if (!figure) continue;
                
                let imgElement = figure.querySelector('img');
                const imgContainer = figure.querySelector('[data-cy="resource-thumbnail"]');
                if (!imgElement && imgContainer) {
                    imgElement = imgContainer.querySelector('img');
                }
                
                const imageInfo: any = {
                    url,
                    hasImg: !!imgElement,
                    imgTag: imgElement?.tagName,
                    imgSrc: imgElement?.src,
                    imgDataSrc: imgElement?.getAttribute('data-src'),
                    imgAlt: imgElement?.alt,
                    imgAttributes: imgElement ? Array.from(imgElement.attributes).map(attr => `${attr.name}="${attr.value}"`) : []
                };
                
                images.push(imageInfo);
            }
            
            return images;
        });
        
        console.log('\n\nExtracted image data:');
        extractedImages.forEach((img: any, i: number) => {
            console.log(`\nImage ${i + 1}:`);
            console.log(`- URL: ${img.url}`);
            console.log(`- Has img element: ${img.hasImg}`);
            console.log(`- Img src: ${img.imgSrc || 'none'}`);
            console.log(`- Img data-src: ${img.imgDataSrc || 'none'}`);
            console.log(`- Img alt: ${img.imgAlt || 'none'}`);
            console.log(`- All attributes: ${img.imgAttributes.join(', ')}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
    
    await browser.close();
}

debugFreepikImages().catch(console.error);