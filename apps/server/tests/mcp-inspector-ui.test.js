/* eslint-env node */
import puppeteer from 'puppeteer';

(async () => {
  const inspectorUrl = 'http://localhost:6274';
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  try {
    await page.goto(inspectorUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    // Wait for the main Inspector UI to load (look for a known element)
    await page.waitForSelector('body', { timeout: 10000 });
    // Check for a title or header
    const title = await page.title();
    if (!title.toLowerCase().includes('inspector')) {
      throw new Error('Inspector UI did not load as expected (title: ' + title + ')');
    }
    // Optionally, check for a known UI element (e.g., prompt list, connect button)
    const hasPromptList = await page.$('[data-testid="prompt-list"], .prompt-list, .prompts') !== null;
    // eslint-disable-next-line no-console
    console.log('Inspector UI loaded. Title:', title, 'Prompt list present:', hasPromptList);
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Inspector UI test failed:', err);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  } finally {
    await browser.close();
  }
})(); 