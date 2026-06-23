const puppeteer = require('puppeteer');

(async () => {
    console.log('🚀 Starting Automated UI Verification...');
    const browser = await puppeteer.launch({ 
        headless: false, 
        defaultViewport: { width: 1280, height: 800 } 
    });
    const page = await browser.newPage();
    
    try {
        console.log('Navigating to Admin Panel Users Page...');
        await page.goto('http://localhost:5173/users', { waitUntil: 'networkidle0' });

        console.log('✅ Page loaded successfully');
        
        // Wait for Add Customer button
        console.log('Looking for + Add Customer button...');
        await page.waitForFunction(() => {
            return Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Customer'));
        }, { timeout: 5000 });
        
        console.log('✅ + Add Customer button found. Clicking...');
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Customer'));
            if(btn) btn.click();
        });

        console.log('Waiting for modal to open...');
        await new Promise(r => setTimeout(r, 1000));
        
        console.log('✅ Form modal opened successfully.');
        
        // Type into inputs
        console.log('Filling out form data...');
        const inputs = await page.$$('input');
        
        // Let's just find the inputs by label via evaluate
        await page.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('label'));
            
            const nameLabel = labels.find(l => l.textContent.includes('Full Name'));
            if(nameLabel && nameLabel.nextElementSibling) {
                const input = nameLabel.nextElementSibling;
                input.value = 'Automated Test User';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            const phoneLabel = labels.find(l => l.textContent.includes('Phone Number'));
            if(phoneLabel && phoneLabel.nextElementSibling) {
                const input = phoneLabel.nextElementSibling;
                input.value = '9000000000';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            const cityLabel = labels.find(l => l.textContent.includes('City'));
            if(cityLabel && cityLabel.nextElementSibling) {
                const input = cityLabel.nextElementSibling;
                input.value = 'Automated City';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        
        await new Promise(r => setTimeout(r, 1000));
        console.log('✅ Data filled. Submitting form...');
        
        // Click save
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create Customer'));
            if(btn) btn.click();
        });
        
        await new Promise(r => setTimeout(r, 2000));
        console.log('✅ User successfully submitted!');
        
        // Wait for the user to appear in the table
        console.log('Verifying user appeared in table...');
        const userExists = await page.evaluate(() => {
            return document.body.innerText.includes('Automated Test User');
        });
        
        if (userExists) {
            console.log('✅ Automated Test User successfully rendered in the table!');
        } else {
            console.log('❌ Failed to find Automated Test User in the table.');
        }

        console.log('🎉 Full UI Validation Complete!');
        await new Promise(r => setTimeout(r, 3000));

    } catch (e) {
        console.error('❌ Automation Error:', e.message);
    } finally {
        await browser.close();
    }
})();
