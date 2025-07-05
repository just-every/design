#!/usr/bin/env npx tsx

import { chromium } from 'playwright';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function debugFreepikContent() {
    console.log('🔍 Debugging Freepik page content...\n');
    
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
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        // Wait longer for dynamic content
        await page.waitForTimeout(8000);
        
        // Take screenshot
        await page.screenshot({ path: 'freepik-content.png', fullPage: false });
        console.log('Screenshot saved as freepik-content.png\n');
        
        // Check for various container patterns
        const contentAnalysis = await page.evaluate(() => {
            const analysis: any = {};
            
            // Look for common grid/list patterns
            const patterns = [
                'article',
                '[role="article"]',
                '[data-testid*="card"]',
                '[data-testid*="result"]',
                '[class*="grid"] > div > a',
                '[class*="Grid"] > div > a',
                '[class*="results"] a',
                '[class*="showcase"] a',
                'a[href*="/free-"][class]',
                'a[href*="/premium-"][class]',
                'div[class*="item"] a',
                'div[class*="card"] a'
            ];
            
            patterns.forEach(pattern => {
                const elements = document.querySelectorAll(pattern);
                if (elements.length > 0) {
                    analysis[pattern] = {
                        count: elements.length,
                        firstElement: {
                            tagName: elements[0].tagName,
                            className: elements[0].className,
                            href: (elements[0] as any).href || null,
                            hasImage: !!elements[0].querySelector('img'),
                            innerHTML: elements[0].innerHTML.substring(0, 200)
                        }
                    };
                }
            });
            
            // Look for any links to resources
            const resourceLinks = Array.from(document.querySelectorAll('a[href*="/free-"], a[href*="/premium-"]'))
                .filter(a => {
                    const href = (a as HTMLAnchorElement).href;
                    return href.includes('.htm') || href.includes('vector') || href.includes('photo') || href.includes('psd');
                })
                .slice(0, 5);
                
            analysis.resourceLinks = resourceLinks.map(a => ({
                href: (a as HTMLAnchorElement).href,
                text: a.textContent?.trim().substring(0, 50),
                parent: a.parentElement?.tagName,
                parentClass: a.parentElement?.className
            }));
            
            // Check main content area
            const main = document.querySelector('main, [role="main"], #main-content');
            if (main) {
                analysis.mainContent = {
                    found: true,
                    childrenCount: main.children.length,
                    innerHTML: main.innerHTML.substring(0, 500)
                };
            }
            
            return analysis;
        });
        
        console.log('Content Analysis Results:\n');
        
        Object.entries(contentAnalysis).forEach(([key, value]: [string, any]) => {
            if (key === 'resourceLinks') {
                console.log('\nResource Links Found:');
                value.forEach((link: any, i: number) => {
                    console.log(`${i + 1}. ${link.href}`);
                    console.log(`   Text: ${link.text || 'no text'}`);
                    console.log(`   Parent: <${link.parent} class="${link.parentClass}">`);
                });
            } else if (key === 'mainContent') {
                console.log('\nMain Content:');
                console.log(`- Found: ${value.found}`);
                console.log(`- Children: ${value.childrenCount}`);
                console.log(`- HTML preview: ${value.innerHTML.substring(0, 200)}...`);
            } else if (value.count > 0) {
                console.log(`\nPattern "${key}": ${value.count} elements`);
                console.log(`- First element: <${value.firstElement.tagName} class="${value.firstElement.className}">`);
                console.log(`- Has href: ${!!value.firstElement.href}`);
                console.log(`- Has image: ${value.firstElement.hasImage}`);
                console.log(`- HTML: ${value.firstElement.innerHTML.substring(0, 100)}...`);
            }
        });
        
        // Final check - look for any images
        const imageCheck = await page.evaluate(() => {
            const allImages = document.querySelectorAll('img');
            const visibleImages = Array.from(allImages).filter(img => {
                const rect = img.getBoundingClientRect();
                return rect.width > 50 && rect.height > 50;
            });
            
            return {
                totalImages: allImages.length,
                visibleImages: visibleImages.length,
                firstFewImages: visibleImages.slice(0, 3).map(img => ({
                    src: img.src,
                    alt: img.alt,
                    width: img.width,
                    height: img.height
                }))
            };
        });
        
        console.log('\n\nImage Check:');
        console.log(`- Total images: ${imageCheck.totalImages}`);
        console.log(`- Visible images (>50px): ${imageCheck.visibleImages}`);
        imageCheck.firstFewImages.forEach((img: any, i: number) => {
            console.log(`\nImage ${i + 1}:`);
            console.log(`- src: ${img.src}`);
            console.log(`- alt: ${img.alt || 'no alt'}`);
            console.log(`- size: ${img.width}x${img.height}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
    
    await browser.close();
}

debugFreepikContent().catch(console.error);