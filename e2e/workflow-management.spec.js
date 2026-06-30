import { test, expect } from '@playwright/test';

const SUPER_ADMIN = { id: 'SUPER_ADMIN_001', password: 'admin1234' };
const ADMIN_TEST = { id: 'ADMIN_FLOW_TEST_001', password: 'admin1234' };
const CATEGORY = {
  categoryKey: 'REPAIR_WORKFLOW_TEST',
  displayName: 'Repair Workflow Test',
  sortOrder: '100',
  active: true,
};
const STATUSES = [
  {
    displayName: 'Custom New',
    statusKey: 'CUSTOM_NEW',
    behaviorBucket: 'NEW',
    terminal: false,
    sortOrder: '100',
  },
  {
    displayName: 'Custom In Progress',
    statusKey: 'CUSTOM_IN_PROGRESS',
    behaviorBucket: 'IN_PROGRESS',
    terminal: false,
    sortOrder: '200',
  },
  {
    displayName: 'Custom Done',
    statusKey: 'CUSTOM_DONE',
    behaviorBucket: 'COMPLETED',
    terminal: true,
    sortOrder: '300',
  },
];
const ACTIONS = [
  { displayName: 'Start Simple Work', actionKey: 'START_SIMPLE_WORK', sortOrder: '300' },
  { displayName: 'Complete Simple Work', actionKey: 'COMPLETE_SIMPLE_WORK', sortOrder: '310' },
];
const TRANSITIONS = [
  { from: 'CUSTOM_NEW', actionKey: 'START_SIMPLE_WORK', to: 'CUSTOM_IN_PROGRESS', displayName: 'Start Simple Work' },
  { from: 'CUSTOM_IN_PROGRESS', actionKey: 'COMPLETE_SIMPLE_WORK', to: 'CUSTOM_DONE', displayName: 'Complete Simple Work' },
];

async function login(page, employeeId, password) {
  await page.goto('/employee-login');
  await expect(page.getByRole('heading', { name: /Employee Login/i })).toBeVisible();
  await page.getByRole('textbox', { name: /Employee ID/i }).fill(employeeId);
  await page.getByRole('textbox', { name: /Password/i }).fill(password);
  await Promise.all([
    page.waitForNavigation({ url: /employee-dashboard|tickets/ }),
    page.getByRole('button', { name: /^Login$/i }).click(),
  ]);
  await expect(page).toHaveURL(/employee-dashboard|tickets/);
}

async function logout(page) {
  await page.getByRole('button', { name: /Logout/i }).click();
  await expect(page).toHaveURL(/employee-login/);
}

async function openWorkflowManagement(page) {
  await page.goto('/employee-dashboard');
  await expect(page.getByText(/Administration Tools/i)).toBeVisible({ timeout: 20000 });
  await page.getByText(/Administration Tools/i).click();
  await page.getByRole('button', { name: /Workflow Management/i }).click();
  await expect(page).toHaveURL(/\/admin\/workflow/);
  await expect(page.getByRole('heading', { name: /Workflow Management/i })).toBeVisible({ timeout: 20000 });
}

async function openTicketCategoryManagement(page) {
  await page.goto('/admin/ticket-categories');
  await expect(page.getByRole('heading', { name: /Ticket Categories/i })).toBeVisible({ timeout: 15000 });
}

async function createTicketCategoryIfMissing(page, category) {
  await openTicketCategoryManagement(page);
  await page.waitForLoadState('networkidle');

  const existingCategory = page.getByText(category.categoryKey, { exact: true }).first();
  if (await existingCategory.count()) {
    return;
  }

  await page.getByRole('button', { name: /Add Category/i }).click();
  await expect(page.getByLabel(/Category Key/i)).toBeVisible({ timeout: 10000 });
  await page.getByLabel(/Category Key/i).fill(category.categoryKey);
  await page.getByLabel(/Display Name/i).fill(category.displayName);
  await page.getByLabel(/Sort Order/i).fill(category.sortOrder);

  const activeCheckbox = page.getByLabel(/Active/i);
  if (category.active && !(await activeCheckbox.isChecked())) {
    await activeCheckbox.check();
  }

  await page.getByRole('button', { name: /Create Category/i }).click();
  await page.waitForTimeout(2000);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: /Ticket Categories/i })).toBeVisible({ timeout: 20000 });
}

async function selectCategory(page, categoryKey) {
  const select = page.getByRole('combobox', { name: /Category/i });
  await expect(select).toBeVisible({ timeout: 15000 });

  const optionValue = await select.evaluate((selectEl, key) => {
    const normalizedKey = key.toLowerCase();
    const option = Array.from(selectEl.options).find((option) => {
      const label = option.textContent?.toLowerCase() || '';
      return label.includes(normalizedKey) || label.includes(normalizedKey.replace(/_/g, ' '));
    });
    return option?.value || null;
  }, categoryKey);

  if (!optionValue) {
    await page.reload({ waitUntil: 'networkidle' });
    const refreshedOptionValue = await select.evaluate((selectEl, key) => {
      const normalizedKey = key.toLowerCase();
      const option = Array.from(selectEl.options).find((option) => {
        const label = option.textContent?.toLowerCase() || '';
        return label.includes(normalizedKey) || label.includes(normalizedKey.replace(/_/g, ' '));
      });
      return option?.value || null;
    }, categoryKey);

    if (!refreshedOptionValue) {
      throw new Error(`Category '${categoryKey}' not found in workflow category selector`);
    }

    await select.selectOption(refreshedOptionValue);
    return;
  }

  await select.selectOption(optionValue);
  await expect(page.locator(`text=${categoryKey}`)).toBeVisible({ timeout: 15000 });
}

async function openTab(page, tabLabel) {
  await page.getByRole('button', { name: new RegExp(`^${tabLabel}$`, 'i') }).click();
}

async function createStatusIfMissing(page, statusConfig) {
  await openTab(page, 'Statuses');
  const existingRow = page.locator('tbody tr', { hasText: statusConfig.statusKey }).first();
  if (await existingRow.count()) {
    return;
  }

  await page.getByRole('button', { name: /Create Status/i }).click();
  const dialog = page.getByRole('dialog', { name: /Create Custom Status/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Display Name/i).fill(statusConfig.displayName);
  await dialog.getByLabel(/Status Key/i).fill(statusConfig.statusKey);
  const behaviorSelect = dialog.getByLabel(/Behavior Bucket/i);
  const behaviorOptionValue = await behaviorSelect.evaluate((selectEl, searchText) => {
    const normalized = searchText.toLowerCase().replace(/_/g, ' ');
    const option = Array.from(selectEl.options).find((optionEl) => {
      const value = (optionEl.value || '').toLowerCase();
      const label = (optionEl.textContent || '').toLowerCase();
      return value.includes(normalized) || label.includes(normalized);
    });
    return option?.value || null;
  }, statusConfig.behaviorBucket);
  if (!behaviorOptionValue) {
    throw new Error(`Unable to find a behavior bucket option for '${statusConfig.behaviorBucket}'`);
  }
  await behaviorSelect.selectOption(behaviorOptionValue);
  await dialog.getByLabel(/Sort Order/i).fill(statusConfig.sortOrder);
  if (statusConfig.terminal) {
    await dialog.getByLabel(/Terminal status/i).check();
  }
  await dialog.getByRole('button', { name: /^Save$/i }).click();
  await page.waitForTimeout(1000);
  await expect(page.locator('tbody tr', { hasText: statusConfig.statusKey })).toBeVisible({ timeout: 15000 });
}

async function createActionIfMissing(page, { displayName, actionKey, sortOrder }) {
  await openTab(page, 'Actions');
  const existingRow = page.locator('tbody tr', { hasText: actionKey }).first();
  if (await existingRow.count()) {
    return;
  }

  await page.getByRole('button', { name: /Create Action/i }).click();
  const dialog = page.getByRole('dialog', { name: /Create Custom Action/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Display Name/i).fill(displayName);
  await dialog.getByLabel(/Action Key/i).fill(actionKey);
  await dialog.getByLabel(/Button Label/i).fill(displayName);
  await dialog.getByLabel(/Sort Order/i).fill(sortOrder);
  await dialog.getByRole('button', { name: /^Save$/i }).click();
  await page.waitForTimeout(1000);
  await expect(page.locator('tbody tr', { hasText: actionKey })).toBeVisible({ timeout: 15000 });
}

async function selectOptionByLabel(page, label, searchText) {
  const select = page.getByLabel(new RegExp(label, 'i'));
  await expect(select).toBeVisible();
  const optionValue = await select.evaluate((selectEl, search) => {
    const normalized = search.toLowerCase();
    const option = Array.from(selectEl.options).find((option) => {
      const text = option.textContent?.toLowerCase() || '';
      return text.includes(normalized);
    });
    return option?.value || null;
  }, searchText);
  if (!optionValue) {
    throw new Error(`Unable to find option '${searchText}' for '${label}'`);
  }
  await select.selectOption(optionValue);
}

async function createTransitionIfMissing(page, { from, actionKey, to, displayName }) {
  await openTab(page, 'Transitions');
  const existingRow = page.locator('tbody tr', { hasText: displayName }).first();
  if (await existingRow.count()) {
    return;
  }

  await page.getByRole('button', { name: /Create Transition/i }).click();
  const dialog = page.getByRole('dialog', { name: /Create workflow transition/i });
  await expect(dialog).toBeVisible();
  await selectOptionByLabel(page, 'From Status', from);
  await selectOptionByLabel(page, 'Action', actionKey);
  await selectOptionByLabel(page, 'To Status', to);
  await dialog.getByLabel(/Display Name/i).fill(displayName);
  await dialog.getByLabel(/Sort Order/i).fill('300');
  await dialog.getByRole('button', { name: /^Save$/i }).click();
  await page.waitForTimeout(1000);
  await expect(page.locator('tbody tr', { hasText: displayName })).toBeVisible({ timeout: 15000 });
}

async function setTransitionRule(page, displayName, sectionLabel, roleOrCategoryName) {
  await openTab(page, 'Transitions');
  const row = page.locator('tbody tr', { hasText: displayName }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.click();

  const drawer = page.getByRole('dialog', { name: /Workflow details/i });
  await expect(drawer).toBeVisible({ timeout: 15000 });
  if (sectionLabel === 'Selected Category Rule') {
    await drawer.getByRole('button', { name: /^Enable$/i }).first().click();
  } else {
    const roleSection = drawer.locator('div', { hasText: roleOrCategoryName });
    await expect(roleSection).toBeVisible();
    await roleSection.getByRole('button', { name: /^Enable$/i }).click();
  }
  await page.getByRole('button', { name: /Confirm(?: Change)?/i }).click();
  await page.waitForTimeout(1000);
}

async function runValidation(page) {
  await openTab(page, 'Validation');
  await page.getByRole('button', { name: /Run Validation/i }).click();
  await expect(page.locator('body')).toContainText('readyToActivate: false', { timeout: 30000 });
}

async function activateWorkflow(page) {
  await openTab(page, 'Map');
  const activateButton = page.getByRole('button', { name: /Activate DB Workflow/i });
  await expect(activateButton).toBeEnabled({ timeout: 30000 });
  await activateButton.click();
  const confirmDialog = page.getByRole('dialog', { name: /Confirm category workflow mode change/i });
  await expect(confirmDialog).toBeVisible({ timeout: 15000 });
  await confirmDialog.getByRole('button', { name: /^Confirm$/i }).click();
  await expect(confirmDialog).toBeHidden({ timeout: 30000 });
  await expect(page.locator('text=Mode: DB_CONFIGURED')).toBeVisible({ timeout: 30000 });
}

async function createAdminUser(page) {
  await page.goto('/employee-dashboard');
  await expect(page.getByText(/Administration Tools/i)).toBeVisible({ timeout: 20000 });
  await page.getByText(/Administration Tools/i).click();
  await page.getByRole('button', { name: /Employee Management/i }).click();
  await expect(page).toHaveURL(/\/admin\/employees/);
  await expect(page.getByRole('heading', { name: /Employee Management/i })).toBeVisible({ timeout: 15000 });

  const existingEmployee = page.getByText(ADMIN_TEST.id, { exact: true }).first();
  if (await existingEmployee.count()) {
    return;
  }

  const addButton = page.getByRole('button', { name: /Add Employee/i });
  await addButton.click();
  await expect(page.getByLabel(/Employee ID/i)).toBeVisible();
  await page.getByLabel(/Name/i).fill('Workflow Test Admin');
  await page.getByLabel(/Employee ID/i).fill(ADMIN_TEST.id);
  await page.getByLabel(/Password/i).fill(ADMIN_TEST.password);

  const roleSelect = page.getByLabel(/Role/i);
  await expect(roleSelect).toBeVisible();
  const roleOptionValue = await roleSelect.evaluate((selectEl, searchText) => {
    const normalized = searchText.toLowerCase();
    const option = Array.from(selectEl.options).find((optionEl) => {
      const label = optionEl.textContent?.toLowerCase() || '';
      return label.includes(normalized);
    });
    return option?.value || null;
  }, 'admin');
  if (!roleOptionValue) {
    throw new Error("Unable to find an Admin role option in the employee form");
  }
  await roleSelect.selectOption(roleOptionValue);

  const activeCheckbox = page.getByLabel(/Active/i);
  if (!(await activeCheckbox.isChecked())) {
    await activeCheckbox.check();
  }

  await page.getByRole('button', { name: /Save Employee/i }).click();
  await expect(page.locator(`text=${ADMIN_TEST.id}`)).toBeVisible({ timeout: 20000 });
}

async function createTicket(page, ticketDetails) {
  await page.getByRole('button', { name: /Create Ticket/i }).click();
  await expect(page.getByRole('heading', { name: /Create Ticket/i })).toBeVisible({ timeout: 15000 });
  await page.getByLabel(/Customer Name/i).fill(ticketDetails.customerName);
  await page.getByLabel(/Mobile Number/i).fill(ticketDetails.mobileNumber);
  await page.getByLabel(/Product Type/i).fill(ticketDetails.productType);
  await page.getByLabel(/Complaint Description/i).fill(ticketDetails.complaintDescription);
  await selectOptionByLabel(page, 'Ticket Category', ticketDetails.categoryKey);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/tickets') && response.status() === 201),
    page.getByRole('button', { name: /Create Ticket/i }).click(),
  ]);
  await expect(page).toHaveURL(/tickets\/[0-9]+/);
  return page.url();
}

async function expectTicketActions(page, availableAction, absentAction) {
  await expect(page.getByRole('button', { name: availableAction })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: absentAction })).toHaveCount(0);
}

async function executeAction(page, actionName, expectedStatusText) {
  const button = page.getByRole('button', { name: actionName }).first();
  await expect(button).toBeVisible({ timeout: 15000 });
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/tickets') && response.status() >= 200 && response.status() < 300),
    button.click(),
  ]);
  await expect(page.locator(`text=${expectedStatusText}`)).toBeVisible({ timeout: 15000 });
}

async function expectWorkflowHistory(page) {
  await expect(page.getByRole('heading', { name: /Workflow History/i })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('text=Start Simple Work')).toBeVisible();
  await expect(page.locator('text=Complete Simple Work')).toBeVisible();
}

test('SUPER_ADMIN can configure a simple UI workflow', async ({ page }) => {
  await login(page, SUPER_ADMIN.id, SUPER_ADMIN.password);
  await createTicketCategoryIfMissing(page, CATEGORY);
  await createAdminUser(page);
  await openWorkflowManagement(page);
  await selectCategory(page, CATEGORY.categoryKey);
  for (const status of STATUSES) {
    await createStatusIfMissing(page, status);
  }
  for (const action of ACTIONS) {
    await createActionIfMissing(page, action);
  }
  for (const transition of TRANSITIONS) {
    await createTransitionIfMissing(page, transition);
  }
  await runValidation(page);
  await expect(page.locator('text=Validation: Not Ready')).toBeVisible({ timeout: 15000 });
});
