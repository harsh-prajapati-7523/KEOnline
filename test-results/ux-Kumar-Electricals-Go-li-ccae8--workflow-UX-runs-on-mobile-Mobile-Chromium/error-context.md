# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ux.spec.js >> Kumar Electricals Go-live UX E2E >> Run five ticket workflow UX runs on mobile
- Location: e2e/ux.spec.js:225:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Picked')
Expected: visible
Error: strict mode violation: locator('text=Picked') resolved to 3 elements:
    1) <span class="max-w-full break-words rounded-full bg-white/15 px-3 py-1 text-xs font-bold">Picked</span> aka locator('header').getByText('Picked')
    2) <dd class="mt-1 break-words text-gray-800">Picked</dd> aka getByRole('definition').filter({ hasText: 'Picked' })
    3) <dt class="font-bold text-gray-500">Picked By</dt> aka getByText('Picked By')

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Picked')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]: ke
        - generic [ref=e7]:
          - heading "KUMAR ELECTRONICS & ELECTRICALS" [level=1] [ref=e8]
          - paragraph [ref=e9]: POWER BACKUP & SOLAR SOLUTIONS
      - generic [ref=e10]:
        - generic [ref=e11]: Bootstrap SUPER_ADMIN
        - button "Dashboard" [ref=e12]:
          - img [ref=e13]
          - text: Dashboard
        - button "Tickets" [ref=e18]:
          - img [ref=e19]
          - text: Tickets
        - button "Logout" [ref=e22]
  - main [ref=e23]:
    - generic [ref=e24]:
      - button "Back to Tickets" [ref=e25]:
        - img [ref=e26]
        - text: Back to Tickets
      - generic [ref=e28]:
        - generic [ref=e29]:
          - paragraph [ref=e30]: Ticket Number
          - generic [ref=e31]:
            - heading "KE-037" [level=1] [ref=e32]
            - generic [ref=e33]: Picked
        - paragraph [ref=e34]: Ticket picked successfully.
        - generic [ref=e35]:
          - generic [ref=e36]:
            - generic [ref=e37]:
              - heading "Available Actions" [level=2] [ref=e38]
              - paragraph [ref=e39]: Use these workflow actions for this ticket.
            - generic [ref=e40]: Workflow
          - generic [ref=e41]:
            - button "Pick Ticket" [ref=e42]
            - button "Start Work" [ref=e43]
            - button "Cancel Ticket" [ref=e44]
        - generic [ref=e45]:
          - heading "Customer Details" [level=2] [ref=e46]
          - generic [ref=e47]:
            - generic [ref=e48]:
              - term [ref=e49]: Customer Name
              - definition [ref=e50]: AUTO UX WORKFLOW 1 2026-06-25T05-59-49-356Z
            - generic [ref=e51]:
              - term [ref=e52]: Mobile Number
              - definition [ref=e53]:
                - generic [ref=e54]:
                  - img [ref=e55]
                  - text: "9990045224"
            - generic [ref=e57]:
              - term [ref=e58]: Village / Area
              - definition [ref=e59]:
                - generic [ref=e60]:
                  - img [ref=e61]
                  - text: Not available
        - generic [ref=e65]:
          - heading "Customer History" [level=2] [ref=e66]
          - button "View" [ref=e67]:
            - generic [ref=e68]:
              - img [ref=e69]
              - text: View
        - generic [ref=e72]:
          - heading "Product & Complaint" [level=2] [ref=e73]
          - generic [ref=e74]:
            - generic [ref=e75]:
              - term [ref=e76]: Product Type
              - definition [ref=e77]: AUTO PRODUCT
            - generic [ref=e78]:
              - term [ref=e79]: Category
              - definition [ref=e80]: BATTERY_RECHARGE
            - generic [ref=e81]:
              - term [ref=e82]: Complaint Description
              - definition [ref=e83]: Automated UX test complaint
        - generic [ref=e84]:
          - heading "Status / Workflow Details" [level=2] [ref=e85]
          - generic [ref=e86]:
            - generic [ref=e87]:
              - term [ref=e88]: Status
              - definition [ref=e89]: Picked
            - generic [ref=e90]:
              - term [ref=e91]: Picked By
              - definition [ref=e92]: SUPER_ADMIN_001
            - generic [ref=e93]:
              - term [ref=e94]: Created Date
              - definition [ref=e95]:
                - generic [ref=e96]:
                  - img [ref=e97]
                  - text: 6/25/2026
        - generic [ref=e99]:
          - heading "Workflow History" [level=2] [ref=e100]
          - article [ref=e103]:
            - generic [ref=e104]:
              - generic [ref=e105]:
                - heading "Pick Ticket" [level=3] [ref=e106]
                - paragraph [ref=e107]: New → Picked
              - generic [ref=e108]: 6/25/2026, 11:29:52 AM
            - generic [ref=e109]:
              - generic [ref=e110]:
                - term [ref=e111]: Executed By
                - definition [ref=e112]: Bootstrap SUPER_ADMIN
              - generic [ref=e113]:
                - term [ref=e114]: Owner Change
                - definition [ref=e115]: Unassigned → SUPER_ADMIN_001
        - generic [ref=e117]:
          - generic [ref=e118]:
            - heading "Charges" [level=2] [ref=e119]
            - paragraph [ref=e120]: "Total Charge: ₹0.00"
          - button "View Charges" [ref=e121]:
            - generic [ref=e122]:
              - img [ref=e123]
              - text: View Charges
        - generic [ref=e126]:
          - heading "Actions" [level=2] [ref=e129]
          - generic [ref=e130]:
            - button "Pick Ticket" [ref=e131]
            - button "Start Work" [ref=e132]
            - button "Cancel Ticket" [ref=e133]
```

# Test source

```ts
  9   | const accounts = [
  10  |   { id: 'SUPER_ADMIN_001', password: 'admin1234', name: 'Super Admin' },
  11  |   { id: 'sushilk999', password: '1234567890', name: 'Admin' },
  12  |   { id: 'sushilv001', password: '1234567890', name: 'Technician' },
  13  | ];
  14  | 
  15  | async function captureScreenshot(page, filename) {
  16  |   await page.screenshot({ path: path.join(screenshotDir, filename), fullPage: true });
  17  | }
  18  | 
  19  | async function assertNoHorizontalOverflow(page) {
  20  |   const overflow = await page.evaluate(() => {
  21  |     return (
  22  |       document.documentElement.scrollWidth <= window.innerWidth &&
  23  |       document.body.scrollWidth <= window.innerWidth
  24  |     );
  25  |   });
  26  |   expect(overflow).toBe(true);
  27  | }
  28  | 
  29  | async function login(page, id, password) {
  30  |   await page.goto('/employee-login');
  31  |   await expect(page.getByRole('heading', { name: /Employee Login/i })).toBeVisible();
  32  |   await expect(page.getByRole('textbox', { name: /Employee ID/i })).toBeVisible();
  33  |   await expect(page.getByRole('textbox', { name: /Password/i })).toBeVisible();
  34  |   await expect(page.getByRole('button', { name: /^Login$/i })).toBeVisible();
  35  | 
  36  |   await page.getByRole('textbox', { name: /Employee ID/i }).fill(id);
  37  |   await page.getByRole('textbox', { name: /Password/i }).fill(password);
  38  |   await Promise.all([
  39  |     page.waitForNavigation({ url: /employee-dashboard|tickets/ }),
  40  |     page.getByRole('button', { name: /^Login$/i }).click(),
  41  |   ]);
  42  | 
  43  |   await expect(page).toHaveURL(/employee-dashboard|tickets/);
  44  | }
  45  | 
  46  | async function createTicket(page, customerName, mobileNumber) {
  47  |   await page.goto('/tickets/new');
  48  |   await expect(page.getByRole('heading', { name: /Create Ticket/i })).toBeVisible();
  49  | 
  50  |   await expect(page.getByRole('textbox', { name: /Customer Name/i })).toBeVisible();
  51  |   await expect(page.getByRole('textbox', { name: /Mobile Number/i })).toBeVisible();
  52  |   await expect(page.getByRole('textbox', { name: /Product Type/i })).toBeVisible();
  53  |   await expect(page.getByRole('combobox', { name: /Ticket Category/i })).toBeVisible();
  54  |   await expect(page.getByRole('textbox', { name: /Complaint Description/i })).toBeVisible();
  55  | 
  56  |   await page.getByRole('textbox', { name: /Customer Name/i }).fill(customerName);
  57  |   await page.getByRole('textbox', { name: /Mobile Number/i }).fill(mobileNumber);
  58  |   await page.getByRole('textbox', { name: /Product Type/i }).fill('AUTO PRODUCT');
  59  |   await page.getByRole('combobox', { name: /Ticket Category/i }).selectOption({ label: 'Battery Recharge (BATTERY_RECHARGE)' });
  60  |   await page.getByRole('textbox', { name: /Complaint Description/i }).fill('Automated UX test complaint');
  61  | 
  62  |   await captureScreenshot(page, `create-ticket-page-${Date.now()}.png`);
  63  | 
  64  |   await Promise.all([
  65  |     page.waitForResponse((response) => response.url().includes('/tickets') && response.status() === 201),
  66  |     page.getByRole('button', { name: /Create Ticket/i }).click(),
  67  |   ]);
  68  | 
  69  |   await page.waitForURL(/tickets\/\d+/);
  70  |   await expect(page.locator('text=/Warranty/i')).toHaveCount(0);
  71  |   await assertNoHorizontalOverflow(page);
  72  |   await captureScreenshot(page, `created-ticket-${Date.now()}.png`);
  73  | 
  74  |   return page.url();
  75  | }
  76  | 
  77  | async function getTicketStatus(page) {
  78  |   return page.evaluate(() => {
  79  |     const bodyText = document.body.innerText;
  80  |     const match = bodyText.match(/Status\s*\n\s*([A-Za-z ]+)/i);
  81  |     return match ? match[1].trim() : '';
  82  |   });
  83  | }
  84  | 
  85  | async function getAvailableWorkflowActions(page) {
  86  |   return page.$$eval('button', (buttons) =>
  87  |     buttons
  88  |       .map((button) => button.innerText.trim())
  89  |       .filter((text) => /Pick Ticket|Start Work|Complete Ticket|Cancel Ticket/i.test(text))
  90  |   );
  91  | }
  92  | 
  93  | async function performWorkflow(page, ticketUrl, summary) {
  94  |   await page.goto(ticketUrl);
  95  |   await expect(page.locator('text=Available Actions')).toBeVisible();
  96  |   summary.startingStatus = await getTicketStatus(page);
  97  |   summary.availableActions = await getAvailableWorkflowActions(page);
  98  | 
  99  |   const pickButton = page.getByRole('button', { name: /^Pick Ticket$/i }).first();
  100 |   const startButton = page.getByRole('button', { name: /^Start Work$/i }).first();
  101 |   const completeButton = page.getByRole('button', { name: /^Complete Ticket$/i }).first();
  102 |   const cancelButton = page.getByRole('button', { name: /^Cancel Ticket$/i }).first();
  103 | 
  104 |   if (await pickButton.isVisible()) {
  105 |     await Promise.all([
  106 |       page.waitForResponse((response) => response.url().includes('/pick') && response.status() === 200),
  107 |       pickButton.click(),
  108 |     ]);
> 109 |     await expect(page.locator('text=Picked')).toBeVisible({ timeout: 10000 });
      |                                               ^ Error: expect(locator).toBeVisible() failed
  110 |     summary.actionsTaken.push('Pick Ticket');
  111 |   }
  112 | 
  113 |   if (await startButton.isVisible()) {
  114 |     await Promise.all([
  115 |       page.waitForResponse((response) => response.url().includes('/start') && response.status() === 200),
  116 |       startButton.click(),
  117 |     ]);
  118 |     await expect(page.locator('text=In Progress')).toBeVisible({ timeout: 10000 });
  119 |     summary.actionsTaken.push('Start Work');
  120 |   }
  121 | 
  122 |   if (await completeButton.isVisible()) {
  123 |     await Promise.all([
  124 |       page.waitForResponse((response) => response.url().includes('/complete') && response.status() === 200),
  125 |       completeButton.click(),
  126 |     ]);
  127 |     await expect(page.locator('text=Completed')).toBeVisible({ timeout: 10000 });
  128 |     summary.actionsTaken.push('Complete Ticket');
  129 |   } else if (await cancelButton.isVisible()) {
  130 |     await cancelButton.click();
  131 |     await expect(page.locator('text=Cancelled')).toBeVisible({ timeout: 10000 });
  132 |     summary.actionsTaken.push('Cancel Ticket');
  133 |   }
  134 | 
  135 |   summary.endingStatus = await getTicketStatus(page);
  136 |   summary.workflowHistoryUpdated = await page.locator('text=Workflow History').count() > 0;
  137 |   await captureScreenshot(page, `workflow-action-${Date.now()}.png`);
  138 | }
  139 | 
  140 | function uniqueTicketName(prefix) {
  141 |   return `${prefix} ${new Date().toISOString().replace(/[:.]/g, '-')}`;
  142 | }
  143 | 
  144 | function uniqueMobileNumber(index) {
  145 |   return `99900${Math.floor(1000 + Math.random() * 8999)}${index}`.slice(0, 10);
  146 | }
  147 | 
  148 | test.describe('Kumar Electricals Go-live UX E2E', () => {
  149 |   test('Employee login UX and invalid login validation on mobile', async ({ page }) => {
  150 |     const consoleErrors = [];
  151 |     const badResponses = [];
  152 |     page.on('console', (message) => {
  153 |     if (message.type() === 'error' && !/Failed to load resource: the server responded with a status of 401 \(\)/i.test(message.text())) {
  154 |       consoleErrors.push(message.text());
  155 |     }
  156 |     });
  157 | 
  158 |     await page.goto('/employee-login');
  159 |     await assertNoHorizontalOverflow(page);
  160 |     await expect(page.getByRole('textbox', { name: /Employee ID/i })).toBeVisible();
  161 |     await expect(page.getByRole('textbox', { name: /Password/i })).toBeVisible();
  162 |     await expect(page.getByRole('button', { name: /^Login$/i })).toBeVisible();
  163 |     await captureScreenshot(page, 'login-mobile.png');
  164 | 
  165 |     await login(page, accounts[0].id, accounts[0].password);
  166 |     await expect(page.locator('text=Available Work Areas')).toBeVisible();
  167 |     await assertNoHorizontalOverflow(page);
  168 | 
  169 |     await page.goto('/employee-login');
  170 |     await page.getByRole('textbox', { name: /Employee ID/i }).fill('INVALID_USER');
  171 |     await page.getByRole('textbox', { name: /Password/i }).fill('badpass');
  172 |     await page.getByRole('button', { name: /^Login$/i }).click();
  173 |     await expect(page.locator('text=Unable to log in. Please check your employee ID and password.')).toBeVisible();
  174 | 
  175 |     expect(consoleErrors).toEqual([]);
  176 |     expect(badResponses).toEqual([]);
  177 |   });
  178 | 
  179 |   test('Create Ticket UX, ticket creation, and mobile ticket list validation', async ({ page }) => {
  180 |     await login(page, accounts[0].id, accounts[0].password);
  181 |     const ticketNameA = uniqueTicketName('AUTO UX TEST A');
  182 |     const ticketNameB = uniqueTicketName('AUTO UX TEST B');
  183 |     const ticketA = await createTicket(page, ticketNameA, uniqueMobileNumber(1));
  184 |     const ticketB = await createTicket(page, ticketNameB, uniqueMobileNumber(2));
  185 | 
  186 |     await page.goto('/tickets');
  187 |     await assertNoHorizontalOverflow(page);
  188 |     await expect(page.getByRole('heading', { name: /Tickets/i })).toBeVisible();
  189 |     await captureScreenshot(page, 'ticket-list-mobile.png');
  190 | 
  191 |     const searchInput = page.getByRole('searchbox', { name: /Search tickets/i });
  192 |     await searchInput.fill(ticketNameA);
  193 |     await page.keyboard.press('Enter');
  194 |     await page.waitForTimeout(1200);
  195 |     await expect(page.locator(`article:has-text("${ticketNameA}")`)).toBeVisible();
  196 |     await expect(page.getByRole('button', { name: /^View Details$/i })).toBeVisible();
  197 | 
  198 |     await page.locator(`article:has-text("${ticketNameA}") button:has-text("View Details")`).first().click();
  199 |     await expect(page.locator('text=Customer Details')).toBeVisible();
  200 |     await expect(page.locator('body')).not.toContainText(/Warranty/i);
  201 |     await assertNoHorizontalOverflow(page);
  202 |     await captureScreenshot(page, 'ticket-detail-mobile.png');
  203 | 
  204 |     await page.goto(ticketA);
  205 |     await expect(page.locator('text=Available Actions')).toBeVisible();
  206 |     await expect(page.locator('text=Workflow')).toBeVisible();
  207 |   });
  208 | 
  209 |   test('Ticket detail UX and workflow actions are visible on mobile', async ({ page }) => {
```