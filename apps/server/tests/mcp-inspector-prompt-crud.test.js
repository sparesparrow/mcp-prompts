/* eslint-env node */
// eslint-disable-next-line no-undef
import puppeteer from 'puppeteer';

(async () => {
  const inspectorUrl = 'http://localhost:6274';
  const promptText = 'Test Prompt ' + Date.now();
  const editedPromptText = promptText + ' (edited)';
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  try {
    await page.goto(inspectorUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForSelector('body', { timeout: 10000 });
    // Add a prompt (try common UI selectors)
    const addBtn = await page.$('[data-testid="add-prompt"], .add-prompt, button[title="Add"], button:contains("Add")');
    if (!addBtn) throw new Error('Add prompt button not found');
    await addBtn.click();
    // Fill prompt text (try common selectors)
    const input = await page.waitForSelector('input[name="prompt"], textarea[name="prompt"], [data-testid="prompt-input"]', { timeout: 5000 });
    await input.type(promptText);
    // Save prompt
    const saveBtn = await page.$('[data-testid="save-prompt"], .save-prompt, button[title="Save"], button:contains("Save")');
    if (!saveBtn) throw new Error('Save prompt button not found');
    await saveBtn.click();
    // Wait for prompt to appear in list
    await page.waitForFunction(
      // eslint-disable-next-line no-undef
      (text) => { return Array.from(document.querySelectorAll('.prompt-list, [data-testid="prompt-list"] *')).some(el => el.textContent && el.textContent.includes(text)); },
      { timeout: 5000 }, promptText);
    // Edit the prompt
    const editBtn = await page.$('[data-testid="edit-prompt"], .edit-prompt, button[title="Edit"], button:contains("Edit")');
    if (!editBtn) throw new Error('Edit prompt button not found');
    await editBtn.click();
    const editInput = await page.waitForSelector('input[name="prompt"], textarea[name="prompt"], [data-testid="prompt-input"]', { timeout: 5000 });
    await editInput.click({ clickCount: 3 });
    await editInput.type(editedPromptText);
    const saveEditBtn = await page.$('[data-testid="save-prompt"], .save-prompt, button[title="Save"], button:contains("Save")');
    if (!saveEditBtn) throw new Error('Save prompt button (edit) not found');
    await saveEditBtn.click();
    // Wait for edited prompt to appear
    await page.waitForFunction(
      // eslint-disable-next-line no-undef
      (text) => { return Array.from(document.querySelectorAll('.prompt-list, [data-testid="prompt-list"] *')).some(el => el.textContent && el.textContent.includes(text)); },
      { timeout: 5000 }, editedPromptText);
    // Delete the prompt
    const deleteBtn = await page.$('[data-testid="delete-prompt"], .delete-prompt, button[title="Delete"], button:contains("Delete")');
    if (!deleteBtn) throw new Error('Delete prompt button not found');
    await deleteBtn.click();
    // Confirm deletion if needed
    const confirmBtn = await page.$('[data-testid="confirm-delete"], .confirm-delete, button:contains("Confirm"), button:contains("Yes")');
    if (confirmBtn) await confirmBtn.click();
    // Ensure prompt is gone
    await page.waitForFunction(
      // eslint-disable-next-line no-undef
      (text) => { return !Array.from(document.querySelectorAll('.prompt-list, [data-testid="prompt-list"] *')).some(el => el.textContent && el.textContent.includes(text)); },
      { timeout: 5000 }, editedPromptText);
    // eslint-disable-next-line no-console
    console.log('Prompt CRUD test passed.');
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Prompt CRUD test failed:', err);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  } finally {
    await browser.close();
  }
})(); 