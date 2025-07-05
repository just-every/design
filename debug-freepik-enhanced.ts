#!/usr/bin/env npx tsx

import { chromium } from 'playwright';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function debugFreepik() {
    console.log('🔍 Enhanced debugging for Freepik search...\n');
    
    const browser = await chromium.launch({ 
        headless: false, // Run in visible mode to see what's happening
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
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
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
    
    // Log any console messages
    page.on('console', msg => {
        console.log('Browser console:', msg.type(), msg.text());
    });
    
    // Log network requests
    page.on('response', response => {
        if (response.status() >= 400) {
            console.log(`❌ HTTP ${response.status()} for ${response.url()}`);
        }
    });
    
    const url = 'https://www.freepik.com/search?format=search&query=logo%20design';
    console.log(`Navigating to: ${url}\n`);
    
    try {
        const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        
        console.log(`Page status: ${response?.status()}`);
        console.log(`Page URL: ${page.url()}\n`);
        
        // Wait a bit longer
        await page.waitForTimeout(5000);
        
        // Take a screenshot
        await page.screenshot({ path: 'freepik-debug.png' });
        console.log('Screenshot saved as freepik-debug.png\n');
        
        // Check page title
        const title = await page.title();
        console.log(`Page title: ${title}\n`);
        
        // Look for error messages
        const errorMessages = await page.evaluate(() => {
            const errors = [];
            // Check for common error patterns
            const errorSelectors = [
                '[class*="error"]',
                '[class*="captcha"]',
                '[class*="challenge"]',
                '[id*="error"]',
                'h1, h2, h3',
                '.message',
                '[role="alert"]'
            ];
            
            errorSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    const text = el.textContent?.trim();
                    if (text && text.length > 0 && text.length < 200) {
                        errors.push({ selector, text });
                    }
                });
            });
            
            return errors;
        });
        
        if (errorMessages.length > 0) {
            console.log('Potential error messages found:');
            errorMessages.forEach(({ selector, text }) => {
                console.log(`  ${selector}: "${text}"`);
            });
            console.log('');
        }
        
        // Try to find images with different selectors
        const selectors = [
            'figure a[href*="/free-"]',
            'a[data-track-ga="resource-preview"]',
            'figure a',
            'a[href*="/premium-"]',
            'img[src*="cdn-"]',
            'img[data-src]',
            '.showcase__item',
            '[data-cy="resource-thumbnail"]'
        ];
        
        console.log('Searching for images with various selectors...');
        
        for (const selector of selectors) {
            const count = await page.evaluate((sel) => {
                return document.querySelectorAll(sel).length;
            }, selector);
            
            if (count > 0) {
                console.log(`✅ Found ${count} elements with selector: ${selector}`);
                
                // Get first element details
                const details = await page.evaluate((sel) => {
                    const element = document.querySelector(sel);
                    if (!element) return null;
                    
                    const isImg = element.tagName === 'IMG';
                    const href = (element as any).href;
                    const src = (element as any).src;
                    const dataSrc = element.getAttribute('data-src');
                    const alt = element.getAttribute('alt');
                    
                    return { isImg, href, src, dataSrc, alt };
                }, selector);
                
                console.log('  First element details:', details);
            } else {
                console.log(`❌ No elements found with selector: ${selector}`);
            }
        }
        
        // Check page HTML structure
        const bodyLength = await page.evaluate(() => document.body.innerHTML.length);
        console.log(`\nPage body HTML length: ${bodyLength} characters`);
        
        // Keep browser open for manual inspection
        console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
        await page.waitForTimeout(30000);
        
    } catch (error) {
        console.error('Error during navigation:', error);
    }
    
    await browser.close();
}

debugFreepik().catch(console.error);