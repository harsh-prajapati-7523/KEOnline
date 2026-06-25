import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const screenshotDir = path.join(__dirname, 'screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

const accounts = [
  { id: 'SUPER_ADMIN_001', password: 'admin1234', name: 'Super Admin' },
  { id: 'sushilk999', password: '1234567890', name: 'Admin' },
  { id: 'sushilv001', password: '1234567890', name: 'Technician' },
];

async function captureScreenshot(page, filename) {
  await page.screenshot({ path: path.join(screenshotDir, filename), fullPage: true });
}

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    return (
      document.documentElement.scrollWidth <= window.innerWidth &&
      document.body.scrollWidth <= window.innerWidth
    );
  });
  expect(overflow).toBe(true);
}

async function login(page, id, password) {
  await page.goto('/employee-login');
  await expect(page.getByRole('heading', { name: /Employee Login/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Employee ID/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Password/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Login$/i })).toBeVisible();

  await page.getByRole('textbox', { name: /Employee ID/i }).fill(id);
  await page.getByRole('textbox', { name: /Password/i }).fill(password);
  await Promise.all([
    page.waitForNavigation({ url: /employee-dashboard|tickets/ }),
    page.getByRole('button', { name: /^Login$/i }).click(),
  ]);

  await expect(page).toHaveURL(/employee-dashboard|tickets/);
}

async function createTicket(page, customerName, mobileNumber) {
  await page.goto('/tickets/new');
  await expect(page.getByRole('heading', { name: /Create Ticket/i })).toBeVisible();

  await expect(page.getByRole('textbox', { name: /Customer Name/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Mobile Number/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Product Type/i })).toBeVisible();
  await expect(page.getByRole('combobox', { name: /Ticket Category/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Complaint Description/i })).toBeVisible();

  await page.getByRole('textbox', { name: /Customer Name/i }).fill(customerName);
  await page.getByRole('textbox', { name: /Mobile Number/i }).fill(mobileNumber);
  await page.getByRole('textbox', { name: /Product Type/i }).fill('AUTO PRODUCT');
  await page.getByRole('combobox', { name: /Ticket Category/i }).selectOption({ label: 'Battery Recharge (BATTERY_RECHARGE)' });
  await page.getByRole('textbox', { name: /Complaint Description/i }).fill('Automated UX test complaint');

  await captureScreenshot(page, `create-ticket-page-${Date.now()}.png`);

  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/tickets') && response.status() === 201),
    page.getByRole('button', { name: /Create Ticket/i }).click(),
  ]);

  await page.waitForURL(/tickets\/\d+/);
  await expect(page.locator('text=/Warranty/i')).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
  await captureScreenshot(page, `created-ticket-${Date.now()}.png`);

  return page.url();
}

async function getTicketStatus(page) {
  return page.evaluate(() => {
    const bodyText = document.body.innerText;
    const match = bodyText.match(/Status\s*\n\s*([A-Za-z ]+)/i);
    return match ? match[1].trim() : '';
  });
}

async function getAvailableWorkflowActions(page) {
  return page.$$eval('button', (buttons) =>
    buttons
      .map((button) => button.innerText.trim())
      .filter((text) => /Pick Ticket|Start Work|Complete Ticket|Cancel Ticket/i.test(text))
  );
}

async function performWorkflow(page, ticketUrl, summary) {
  await page.goto(ticketUrl);
  await expect(page.locator('text=Available Actions')).toBeVisible();
  summary.startingStatus = await getTicketStatus(page);
  summary.availableActions = await getAvailableWorkflowActions(page);

  const pickButton = page.getByRole('button', { name: /^Pick Ticket$/i }).first();
  const startButton = page.getByRole('button', { name: /^Start Work$/i }).first();
  const completeButton = page.getByRole('button', { name: /^Complete Ticket$/i }).first();
  const cancelButton = page.getByRole('button', { name: /^Cancel Ticket$/i }).first();

  if (await pickButton.isVisible()) {
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/pick') && response.status() === 200),
      pickButton.click(),
    ]);
    await expect(page.locator('text=Picked')).toBeVisible({ timeout: 10000 });
    summary.actionsTaken.push('Pick Ticket');
  }

  if (await startButton.isVisible()) {
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/start') && response.status() === 200),
      startButton.click(),
    ]);
    await expect(page.locator('text=In Progress')).toBeVisible({ timeout: 10000 });
    summary.actionsTaken.push('Start Work');
  }

  if (await completeButton.isVisible()) {
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/complete') && response.status() === 200),
      completeButton.click(),
    ]);
    await expect(page.locator('text=Completed')).toBeVisible({ timeout: 10000 });
    summary.actionsTaken.push('Complete Ticket');
  } else if (await cancelButton.isVisible()) {
    await cancelButton.click();
    await expect(page.locator('text=Cancelled')).toBeVisible({ timeout: 10000 });
    summary.actionsTaken.push('Cancel Ticket');
  }

  summary.endingStatus = await getTicketStatus(page);
  summary.workflowHistoryUpdated = await page.locator('text=Workflow History').count() > 0;
  await captureScreenshot(page, `workflow-action-${Date.now()}.png`);
}

function uniqueTicketName(prefix) {
  return `${prefix} ${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

function uniqueMobileNumber(index) {
  return `99900${Math.floor(1000 + Math.random() * 8999)}${index}`.slice(0, 10);
}

test.describe('Kumar Electricals Go-live UX E2E', () => {
  test('Employee login UX and invalid login validation on mobile', async ({ page }) => {
    const consoleErrors = [];
    const badResponses = [];
    page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource: the server responded with a status of 401 \(\)/i.test(message.text())) {
      consoleErrors.push(message.text());
    }
    });

    await page.goto('/employee-login');
    await assertNoHorizontalOverflow(page);
    await expect(page.getByRole('textbox', { name: /Employee ID/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Password/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Login$/i })).toBeVisible();
    await captureScreenshot(page, 'login-mobile.png');

    await login(page, accounts[0].id, accounts[0].password);
    await expect(page.locator('text=Available Work Areas')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto('/employee-login');
    await page.getByRole('textbox', { name: /Employee ID/i }).fill('INVALID_USER');
    await page.getByRole('textbox', { name: /Password/i }).fill('badpass');
    await page.getByRole('button', { name: /^Login$/i }).click();
    await expect(page.locator('text=Unable to log in. Please check your employee ID and password.')).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(badResponses).toEqual([]);
  });

  test('Create Ticket UX, ticket creation, and mobile ticket list validation', async ({ page }) => {
    await login(page, accounts[0].id, accounts[0].password);
    const ticketNameA = uniqueTicketName('AUTO UX TEST A');
    const ticketNameB = uniqueTicketName('AUTO UX TEST B');
    const ticketA = await createTicket(page, ticketNameA, uniqueMobileNumber(1));
    const ticketB = await createTicket(page, ticketNameB, uniqueMobileNumber(2));

    await page.goto('/tickets');
    await assertNoHorizontalOverflow(page);
    await expect(page.getByRole('heading', { name: /Tickets/i })).toBeVisible();
    await captureScreenshot(page, 'ticket-list-mobile.png');

    const searchInput = page.getByRole('searchbox', { name: /Search tickets/i });
    await searchInput.fill(ticketNameA);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    await expect(page.locator(`article:has-text("${ticketNameA}")`)).toBeVisible();
    await expect(page.getByRole('button', { name: /^View Details$/i })).toBeVisible();

    await page.locator(`article:has-text("${ticketNameA}") button:has-text("View Details")`).first().click();
    await expect(page.locator('text=Customer Details')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Warranty/i);
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, 'ticket-detail-mobile.png');

    await page.goto(ticketA);
    await expect(page.locator('text=Available Actions')).toBeVisible();
    await expect(page.locator('text=Workflow')).toBeVisible();
  });

  test('Ticket detail UX and workflow actions are visible on mobile', async ({ page }) => {
    await login(page, accounts[0].id, accounts[0].password);
    const ticketName = uniqueTicketName('AUTO UX WORKFLOW DETAIL');
    const ticketUrl = await createTicket(page, ticketName, uniqueMobileNumber(3));

    await page.goto(ticketUrl);
    await expect(page.locator('text=Available Actions')).toBeVisible();
    await expect(page.locator('text=Customer Details')).toBeVisible();
    await expect(page.locator('text=Product & Complaint')).toBeVisible();
    await expect(page.locator('text=Status / Workflow Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Workflow History/i })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Warranty/i);
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, 'ticket-detail-actions-mobile.png');
  });

  test('Run five ticket workflow UX runs on mobile', async ({ page }) => {
    await login(page, accounts[0].id, accounts[0].password);
    const workflowResults = [];

    for (let i = 0; i < 5; i += 1) {
      const ticketName = uniqueTicketName(`AUTO UX WORKFLOW ${i + 1}`);
      const ticketUrl = await createTicket(page, ticketName, uniqueMobileNumber(i + 4));
      const summary = {
        ticketName,
        ticketUrl,
        startingStatus: '',
        actionsTaken: [],
        endingStatus: '',
        workflowHistoryUpdated: false,
      };
      await performWorkflow(page, ticketUrl, summary);
      workflowResults.push(summary);
    }

    expect(workflowResults).toHaveLength(5);
    for (const result of workflowResults) {
      expect(result.startingStatus).not.toBe('');
      expect(result.endingStatus).not.toBe('');
      expect(result.actionsTaken.length).toBeGreaterThan(0);
    }
  });
});
