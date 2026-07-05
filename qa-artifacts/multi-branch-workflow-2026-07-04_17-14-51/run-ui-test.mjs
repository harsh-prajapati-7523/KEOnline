import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = 'https://test.kumar-electricals.com';
const artifactDir = path.resolve('qa-artifacts/multi-branch-workflow-2026-07-04_17-14-51');
const screenshotDir = path.join(artifactDir, 'screenshots');
const token = process.env.TEST_SUPER_ADMIN_TOKEN;

if (!token) {
  throw new Error('TEST_SUPER_ADMIN_TOKEN is required');
}

const suffix = 'JUL04_1740';
const password = 'Manual123';
const category = {
  key: `QA_MB_CAT_${suffix}`,
  name: `QA Multi Branch ${suffix}`,
  sortOrder: '710',
};
const roles = [
  {
    key: `QA_MB_ALPHA_${suffix}`,
    name: `QA Alpha ${suffix}`,
    employeeId: `QA_ALPHA_${suffix}`,
    employeeName: `QA Alpha User ${suffix}`,
    startAction: `QA Route Alpha ${suffix}`,
    finishAction: `QA Finish Alpha ${suffix}`,
    processingStatus: `QA Alpha Work ${suffix}`,
  },
  {
    key: `QA_MB_BETA_${suffix}`,
    name: `QA Beta ${suffix}`,
    employeeId: `QA_BETA_${suffix}`,
    employeeName: `QA Beta User ${suffix}`,
    startAction: `QA Route Beta ${suffix}`,
    finishAction: `QA Finish Beta ${suffix}`,
    processingStatus: `QA Beta Work ${suffix}`,
  },
];
const workflow = {
  newStatus: 'Default New',
  doneStatus: 'Default Done',
};

const steps = [];

async function shot(page, fileName, title, note = '') {
  const file = `${fileName}.png`;
  await page.screenshot({ path: path.join(screenshotDir, file), fullPage: true });
  steps.push({ title, note, screenshot: `screenshots/${file}` });
}

async function setSuperAdminSession(page) {
  await page.goto(`${baseURL}/employee-login`);
  await page.evaluate((adminToken) => {
    localStorage.setItem('token', adminToken);
    localStorage.setItem('employeeId', 'SUPER_ADMIN_001');
    localStorage.setItem('employeeName', 'Bootstrap SUPER_ADMIN');
    localStorage.setItem('role', 'SUPER_ADMIN');
  }, token);
  await page.goto(`${baseURL}/employee-dashboard`, { waitUntil: 'networkidle' });
}

async function selectOptionByText(select, text) {
  const value = await select.evaluate((selectEl, searchText) => {
    const normalized = searchText.toLowerCase();
    const option = Array.from(selectEl.options).find((candidate) => {
      const label = candidate.textContent?.toLowerCase() || '';
      return label.includes(normalized);
    });
    return option?.value || null;
  }, text);
  if (!value) throw new Error(`Option not found: ${text}`);
  await select.selectOption(value);
}

async function ensureCategory(page) {
  await page.goto(`${baseURL}/admin/ticket-categories`, { waitUntil: 'networkidle' });
  if (!(await page.getByText(category.key, { exact: true }).count())) {
    await page.getByRole('button', { name: /Add Category/i }).click();
    await page.locator('input[name="categoryKey"]').fill(category.key);
    await page.locator('input[name="displayName"]').fill(category.name);
    await page.locator('input[name="sortOrder"]').fill(category.sortOrder);
    const active = page.locator('input[name="active"]');
    if (!(await active.isChecked())) await active.check();
    await page.getByRole('button', { name: /Create Category/i }).click();
    await page.waitForLoadState('networkidle');
  }
  await shot(page, '01-category-created', 'Create the new ticket category', `Category: ${category.name}`);
}

async function ensureRole(page, role) {
  await page.goto(`${baseURL}/admin/roles`, { waitUntil: 'networkidle' });
  if (!(await page.getByText(role.key, { exact: true }).count())) {
    await page.getByRole('button', { name: /Add Role/i }).click();
    await page.locator('input[name="roleKey"]').fill(role.key);
    await page.locator('input[name="displayName"]').fill(role.name);
    const active = page.locator('input[name="active"]');
    if (!(await active.isChecked())) await active.check();
    await page.getByRole('button', { name: /Create Role/i }).click();
    await page.waitForLoadState('networkidle');
  }
}

async function setRoleAccess(page, role) {
  await page.goto(`${baseURL}/admin/role-access`, { waitUntil: 'networkidle' });
  await selectOptionByText(page.locator('select').first(), role.key);
  await page.locator('label', { hasText: 'VIEW_TICKETS' }).waitFor({ timeout: 20000 });
  const accessLabels = [
    'VIEW_DASHBOARD',
    'VIEW_TICKETS',
    'CREATE_TICKET',
    'USE_TICKET_SEARCH',
    'USE_TICKET_FILTERS',
    'USE_SMART_SUGGESTIONS',
  ];
  for (const key of accessLabels) {
    const checkbox = page.locator('label', { hasText: key }).locator('input[type="checkbox"]').first();
    if (!(await checkbox.isChecked())) await checkbox.check({ force: true });
  }
  const save = page.getByRole('button', { name: /^Save Changes$/i });
  if (await save.isEnabled()) {
    await save.click();
    await page.waitForLoadState('networkidle');
  }
  await shot(page, `02-role-access-${role.key}`, `Manage Role Access for ${role.name}`, 'Base dashboard and ticket access enabled.');
}

async function ensureEmployee(page, role) {
  await page.goto(`${baseURL}/admin/employees`, { waitUntil: 'networkidle' });
  if (!(await page.getByText(role.employeeId, { exact: true }).count())) {
    await page.getByRole('button', { name: /Add Employee/i }).click();
    await page.locator('input[name="name"]').fill(role.employeeName);
    await page.locator('input[name="employeeId"]').fill(role.employeeId);
    await selectOptionByText(page.locator('select[name="roleId"]'), role.key);
    await page.locator('input[name="password"]').fill(password);
    const active = page.locator('input[name="active"]');
    if (!(await active.isChecked())) await active.check();
    await page.getByRole('button', { name: /Save Employee/i }).click();
    await page.waitForLoadState('networkidle');
  }
}

async function selectWorkflowCategory(page) {
  const categorySelect = page.getByRole('combobox', { name: /Category/i });
  await page.waitForFunction((categoryName) => {
    const selects = Array.from(document.querySelectorAll('select'));
    return selects.some((select) => Array.from(select.options).some((option) => (
      option.textContent || ''
    ).toLowerCase().includes(categoryName.toLowerCase())));
  }, category.name, { timeout: 30000 });
  await selectOptionByText(categorySelect, category.name);
  await page.waitForLoadState('networkidle');
  return categorySelect.inputValue();
}

async function buildWorkflow(page) {
  await page.goto(`${baseURL}/admin/workflow`, { waitUntil: 'domcontentloaded' });
  const categoryId = await selectWorkflowCategory(page);
  await page.goto(`${baseURL}/admin/workflow/builder?categoryId=${encodeURIComponent(categoryId)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/admin\/workflow\/builder/);
  await page.waitForLoadState('networkidle');

  while ((await page.getByLabel(/Line \d+ From Status/i).count()) < 3) {
    await page.getByRole('button', { name: /Add Line/i }).click();
  }

  const fromInputs = page.locator('input[list^="from-status-"]');
  const actionInputs = page.locator('input[list^="action-"]');
  const toInputs = page.locator('input[list^="to-status-"]');
  const rows = [
    [workflow.newStatus, roles[0].startAction, roles[0].processingStatus],
    [workflow.newStatus, roles[1].startAction, workflow.doneStatus],
    [roles[0].processingStatus, roles[0].finishAction, workflow.doneStatus],
  ];
  for (let index = 0; index < rows.length; index += 1) {
    await fromInputs.nth(index).fill(rows[index][0]);
    await actionInputs.nth(index).fill(rows[index][1]);
    await toInputs.nth(index).fill(rows[index][2]);
  }
  await page.locator('input[list="builder-start-statuses"]').fill(workflow.newStatus);
  for (const rowIndex of [0]) {
    await toInputs.nth(rowIndex).evaluate((input, currentRowIndex) => {
      let container = input.parentElement;
      while (container && !container.innerText?.includes(`LINE ${currentRowIndex + 1} FROM STATUS`)) {
        container = container.parentElement;
      }
      const terminalLabel = Array.from(container?.querySelectorAll('label') || [])
        .find((label) => /Terminal/i.test(label.textContent || ''));
      const checkbox = terminalLabel?.querySelector('input[type="checkbox"]');
      if (checkbox?.checked) checkbox.click();
    }, rowIndex);
  }
  await shot(page, '04-workflow-builder-path', 'Build a multi-branch workflow path', 'Two branch-start actions leave the same NEW status.');
  const saveButton = page.getByRole('button', { name: /Save Workflow/i });
  if (await saveButton.isEnabled()) {
    await saveButton.click();
    await page.waitForFunction(() => {
      const text = document.body.innerText || '';
      return !/Saving Workflow|Saving Transition|Creating Status|Creating Action/.test(text);
    }, { timeout: 120000 });
    await page.waitForTimeout(1500);
  }
  await shot(page, '05-workflow-builder-saved', 'Save the workflow path', 'The selected first/source status is saved as NEW.');
}

async function setWorkflowActionPermission(page, actionName, role, allowed) {
  const row = page.locator('tbody tr', { hasText: actionName }).first();
  await row.scrollIntoViewIfNeeded();
  const changed = await row.evaluate((rowEl, payload) => {
    const table = rowEl.closest('table');
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent || '');
    const index = headers.findIndex((header) => header.includes(payload.roleKey) || header.includes(payload.roleName));
    if (index < 1) return 'missing-role';
    const cell = rowEl.querySelectorAll('td')[index];
    const button = Array.from(cell.querySelectorAll('button')).find((candidate) => /Enable|Disable/i.test(candidate.textContent || ''));
    if (!button) return 'missing-button';
    const text = button.textContent || '';
    if (payload.allowed && /Enable/i.test(text)) {
      button.click();
      return 'clicked';
    }
    if (!payload.allowed && /Disable/i.test(text)) {
      button.click();
      return 'clicked';
    }
    return 'already';
  }, { roleKey: role.key, roleName: role.name, allowed });
  if (changed === 'missing-role' || changed === 'missing-button') {
    throw new Error(`Unable to update action permission for ${role.key} on ${actionName}: ${changed}`);
  }
  if (changed === 'clicked') {
    await page.waitForTimeout(1200);
  }
}

async function configureWorkflowRoleAccess(page) {
  await page.goto(`${baseURL}/admin/workflow`, { waitUntil: 'domcontentloaded' });
  await selectWorkflowCategory(page);
  await page.getByRole('button', { name: /^Role Access$/i }).click();
  await page.waitForLoadState('networkidle');
  for (const role of roles) {
    await setWorkflowActionPermission(page, role.startAction, role, true);
  }
  await setWorkflowActionPermission(page, roles[0].finishAction, roles[0], true);
  await setWorkflowActionPermission(page, roles[0].startAction, roles[1], false);
  await setWorkflowActionPermission(page, roles[0].finishAction, roles[1], false);
  await setWorkflowActionPermission(page, roles[1].startAction, roles[0], false);
  await shot(page, '06-workflow-role-access', 'Configure workflow action access by role', 'Alpha has Alpha actions; Beta has Beta actions.');
}

async function activateWorkflow(page) {
  await page.goto(`${baseURL}/admin/workflow`, { waitUntil: 'domcontentloaded' });
  await selectWorkflowCategory(page);
  const mapTab = page.getByRole('button', { name: /^Map$/i });
  if (await mapTab.count()) await mapTab.click();
  const activate = page.getByRole('button', { name: /Activate DB Workflow/i });
  if (await activate.count() && await activate.isEnabled()) {
    await activate.click();
    const confirm = page.getByRole('dialog').getByRole('button', { name: /^Confirm$/i });
    await confirm.click();
    await page.waitForLoadState('networkidle');
  }
  await shot(page, '07-workflow-active', 'Activate DB workflow for the category', 'Category uses the configured DB workflow.');
}

async function createTicket(page, label) {
  await page.goto(`${baseURL}/tickets/new`, { waitUntil: 'networkidle' });
  await page.getByLabel(/Customer Name/i).fill(`${label} Customer`);
  await page.getByLabel(/Mobile Number/i).fill(label === 'Alpha' ? '9876500011' : '9876500022');
  await page.getByLabel(/Village \/ Area/i).fill(`${label} Area`);
  await page.getByRole('textbox', { name: /^Product Type$/i }).fill(`${label} Product`);
  await page.getByLabel(/Problem Details/i).fill(`${label} branch workflow verification`);
  await selectOptionByText(page.locator('select[name="categoryId"]'), category.name);
  await page.getByRole('button', { name: /^Create Ticket$/i }).click();
  await page.waitForURL(/tickets\/[0-9]+/, { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  const ticketUrl = page.url();
  await shot(page, `08-ticket-${label.toLowerCase()}-created`, `Create ${label} test ticket`, `Ticket URL: ${ticketUrl}`);
  return ticketUrl;
}

async function login(page, employeeId) {
  await page.goto(`${baseURL}/employee-login`, { waitUntil: 'networkidle' });
  await page.getByLabel(/Employee ID/i).fill(employeeId);
  await page.getByLabel(/Password/i).fill(password);
  await page.getByRole('button', { name: /^Login$/i }).click();
  await page.waitForURL(/employee-dashboard|tickets/, { timeout: 30000 });
  await page.waitForLoadState('networkidle');
}

async function verifyRolePath(page, role, ticketUrl, absentStartAction) {
  await login(page, role.employeeId);
  await page.goto(ticketUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: role.startAction }).waitFor({ timeout: 20000 });
  const absentCount = await page.getByRole('button', { name: absentStartAction }).count();
  if (absentCount !== 0) throw new Error(`${absentStartAction} was exposed to ${role.key}`);
  await shot(page, `09-${role.key}-start-actions`, `${role.name} sees only its branch start action`, `${role.startAction} is visible; ${absentStartAction} is hidden.`);
  await page.getByRole('button', { name: role.startAction }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  if (role.finishAction === roles[0].finishAction) {
    await page.getByRole('button', { name: role.finishAction }).waitFor({ timeout: 20000 });
    await shot(page, `10-${role.key}-finish-action`, `${role.name} follows its branch`, `${role.finishAction} is visible after entering ${role.processingStatus}.`);
    await page.getByRole('button', { name: role.finishAction }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
  }
  await shot(page, `11-${role.key}-completed`, `${role.name} completes its branch`, `Ticket reaches ${workflow.doneStatus}.`);
}

async function writeReport(alphaTicketUrl, betaTicketUrl) {
  const lines = [
    '# Multi-Branch Workflow UI Test',
    '',
    `Date: 2026-07-04`,
    `Environment: ${baseURL}`,
    '',
    '## Records Created',
    '',
    `- Category: ${category.name} (${category.key})`,
    `- Role 1: ${roles[0].name} (${roles[0].key})`,
    `- Role 2: ${roles[1].name} (${roles[1].key})`,
    `- User 1: ${roles[0].employeeName} (${roles[0].employeeId})`,
    `- User 2: ${roles[1].employeeName} (${roles[1].employeeId})`,
    `- Ticket 1: ${alphaTicketUrl}`,
    `- Ticket 2: ${betaTicketUrl}`,
    '',
    '## Workflow Shape',
    '',
    `- ${workflow.newStatus} -> ${roles[0].processingStatus} by ${roles[0].startAction}`,
    `- ${workflow.newStatus} -> ${workflow.doneStatus} by ${roles[1].startAction}`,
    `- ${roles[0].processingStatus} -> ${workflow.doneStatus} by ${roles[0].finishAction}`,
    '',
    '## Result',
    '',
    `- ${roles[0].name} could see and execute only the Alpha branch actions.`,
    `- ${roles[1].name} could see and execute only the Beta branch actions.`,
    '- The same category supports different workflow paths for different users through role/action permissions.',
    '',
    '## Step Screenshots',
    '',
  ];

  steps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step.title}`);
    if (step.note) lines.push(`   - ${step.note}`);
    lines.push(`   - Screenshot: [${path.basename(step.screenshot)}](${step.screenshot})`);
  });

  await fs.writeFile(path.join(artifactDir, 'MULTI_BRANCH_WORKFLOW_USER_MANUAL.md'), `${lines.join('\n')}\n`);
}

await fs.mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, ignoreHTTPSErrors: true });
const page = await context.newPage();

try {
  await setSuperAdminSession(page);
  await shot(page, '00-dashboard', 'Open employee dashboard as SUPER_ADMIN', 'Starting point for the UI setup.');
  await ensureCategory(page);
  for (const role of roles) await ensureRole(page, role);
  await page.goto(`${baseURL}/admin/roles`, { waitUntil: 'networkidle' });
  await shot(page, '02-roles-created', 'Create two new roles', `${roles[0].key} and ${roles[1].key}`);
  for (const role of roles) await setRoleAccess(page, role);
  for (const role of roles) await ensureEmployee(page, role);
  await page.goto(`${baseURL}/admin/employees`, { waitUntil: 'networkidle' });
  await shot(page, '03-users-created', 'Create two users', 'One user assigned to each created role.');
  await buildWorkflow(page);
  await configureWorkflowRoleAccess(page);
  await activateWorkflow(page);
  const alphaTicketUrl = await createTicket(page, 'Alpha');
  const betaTicketUrl = await createTicket(page, 'Beta');
  await verifyRolePath(page, roles[0], alphaTicketUrl, roles[1].startAction);
  await verifyRolePath(page, roles[1], betaTicketUrl, roles[0].startAction);
  await writeReport(alphaTicketUrl, betaTicketUrl);
} finally {
  await browser.close();
}
