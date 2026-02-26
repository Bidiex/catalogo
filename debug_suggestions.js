const { chromium } = require('playwright');

(async () => {
    console.log('Starting Playwright...');
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Listen for console logs
    page.on('console', msg => {
        if (msg.text().includes('DEBUG') || msg.text().includes('currentBusiness')) {
            console.log(`BROWSER MSG: ${msg.text()}`);
        }
    });

    console.log('Navigating to http://localhost:5173/c/burger-premium ...');
    await page.goto('http://localhost:5173/c/burger-premium', { waitUntil: 'networkidle' });

    // Try to open cart directly
    try {
        await page.evaluate(() => {
            const cartFabBtn = document.getElementById('cartFabBtn');
            if (cartFabBtn) cartFabBtn.click();
        });
        await page.waitForTimeout(2000);
    } catch (e) {
        console.log('Could not click cart', e.message);
    }

    await browser.close();
    console.log('Done.');
})();
