# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ux.spec.js >> Kumar Electricals Go-live UX E2E >> Create Ticket UX, ticket creation, and mobile ticket list validation
- Location: e2e/ux.spec.js:179:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Workflow')
Expected: visible
Error: strict mode violation: locator('text=Workflow') resolved to 5 elements:
    1) <p class="mt-1 text-sm font-semibold text-yellow-800">Use these workflow actions for this ticket.</p> aka getByText('Use these workflow actions')
    2) <span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-yellow-900">Workflow</span> aka getByText('Workflow', { exact: true })
    3) <h2 class="text-lg font-bold text-blue-950">Status / Workflow Details</h2> aka getByRole('heading', { name: 'Status / Workflow Details' })
    4) <h2 class="text-lg font-bold text-blue-950">Workflow History</h2> aka getByRole('heading', { name: 'Workflow History' })
    5) <p class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">No workflow history yet.</p> aka getByText('No workflow history yet.')

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for locator('text=Workflow')

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
            - heading "KE-031" [level=1] [ref=e32]
            - generic [ref=e33]: New
        - generic [ref=e34]:
          - generic [ref=e35]:
            - generic [ref=e36]:
              - heading "Available Actions" [level=2] [ref=e37]
              - paragraph [ref=e38]: Use these workflow actions for this ticket.
            - generic [ref=e39]: Workflow
          - generic [ref=e40]:
            - button "Pick Ticket" [ref=e41]
            - button "Cancel Ticket" [ref=e42]
        - generic [ref=e43]:
          - heading "Customer Details" [level=2] [ref=e44]
          - generic [ref=e45]:
            - generic [ref=e46]:
              - term [ref=e47]: Customer Name
              - definition [ref=e48]: AUTO UX TEST A 2026-06-25T05-59-25-226Z
            - generic [ref=e49]:
              - term [ref=e50]: Mobile Number
              - definition [ref=e51]:
                - generic [ref=e52]:
                  - img [ref=e53]
                  - text: "9990039691"
            - generic [ref=e55]:
              - term [ref=e56]: Village / Area
              - definition [ref=e57]:
                - generic [ref=e58]:
                  - img [ref=e59]
                  - text: Not available
        - generic [ref=e63]:
          - heading "Customer History" [level=2] [ref=e64]
          - button "View" [ref=e65]:
            - generic [ref=e66]:
              - img [ref=e67]
              - text: View
        - generic [ref=e70]:
          - heading "Product & Complaint" [level=2] [ref=e71]
          - generic [ref=e72]:
            - generic [ref=e73]:
              - term [ref=e74]: Product Type
              - definition [ref=e75]: AUTO PRODUCT
            - generic [ref=e76]:
              - term [ref=e77]: Category
              - definition [ref=e78]: BATTERY_RECHARGE
            - generic [ref=e79]:
              - term [ref=e80]: Complaint Description
              - definition [ref=e81]: Automated UX test complaint
        - generic [ref=e82]:
          - heading "Status / Workflow Details" [level=2] [ref=e83]
          - generic [ref=e84]:
            - generic [ref=e85]:
              - term [ref=e86]: Status
              - definition [ref=e87]: New
            - generic [ref=e88]:
              - term [ref=e89]: Picked By
              - definition [ref=e90]: Not picked
            - generic [ref=e91]:
              - term [ref=e92]: Created Date
              - definition [ref=e93]:
                - generic [ref=e94]:
                  - img [ref=e95]
                  - text: 6/25/2026
        - generic [ref=e97]:
          - heading "Workflow History" [level=2] [ref=e98]
          - paragraph [ref=e100]: No workflow history yet.
        - generic [ref=e102]:
          - generic [ref=e103]:
            - heading "Charges" [level=2] [ref=e104]
            - paragraph [ref=e105]: "Total Charge: ₹0.00"
          - button "View Charges" [ref=e106]:
            - generic [ref=e107]:
              - img [ref=e108]
              - text: View Charges
        - generic [ref=e111]:
          - heading "Actions" [level=2] [ref=e114]
          - generic [ref=e115]:
            - button "Pick Ticket" [ref=e116]
            - button "Cancel Ticket" [ref=e117]
```

# Test source

```ts
  106 |       page.waitForResponse((response) => response.url().includes('/pick') && response.status() === 200),
  107 |       pickButton.click(),
  108 |     ]);
  109 |     await expect(page.locator('text=Picked')).toBeVisible({ timeout: 10000 });
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
> 206 |     await expect(page.locator('text=Workflow')).toBeVisible();
      |                                                 ^ Error: expect(locator).toBeVisible() failed
  207 |   });
  208 | 
  209 |   test('Ticket detail UX and workflow actions are visible on mobile', async ({ page }) => {
  210 |     await login(page, accounts[0].id, accounts[0].password);
  211 |     const ticketName = uniqueTicketName('AUTO UX WORKFLOW DETAIL');
  212 |     const ticketUrl = await createTicket(page, ticketName, uniqueMobileNumber(3));
  213 | 
  214 |     await page.goto(ticketUrl);
  215 |     await expect(page.locator('text=Available Actions')).toBeVisible();
  216 |     await expect(page.locator('text=Customer Details')).toBeVisible();
  217 |     await expect(page.locator('text=Product & Complaint')).toBeVisible();
  218 |     await expect(page.locator('text=Status / Workflow Details')).toBeVisible();
  219 |     await expect(page.getByRole('heading', { name: /Workflow History/i })).toBeVisible();
  220 |     await expect(page.locator('body')).not.toContainText(/Warranty/i);
  221 |     await assertNoHorizontalOverflow(page);
  222 |     await captureScreenshot(page, 'ticket-detail-actions-mobile.png');
  223 |   });
  224 | 
  225 |   test('Run five ticket workflow UX runs on mobile', async ({ page }) => {
  226 |     await login(page, accounts[0].id, accounts[0].password);
  227 |     const workflowResults = [];
  228 | 
  229 |     for (let i = 0; i < 5; i += 1) {
  230 |       const ticketName = uniqueTicketName(`AUTO UX WORKFLOW ${i + 1}`);
  231 |       const ticketUrl = await createTicket(page, ticketName, uniqueMobileNumber(i + 4));
  232 |       const summary = {
  233 |         ticketName,
  234 |         ticketUrl,
  235 |         startingStatus: '',
  236 |         actionsTaken: [],
  237 |         endingStatus: '',
  238 |         workflowHistoryUpdated: false,
  239 |       };
  240 |       await performWorkflow(page, ticketUrl, summary);
  241 |       workflowResults.push(summary);
  242 |     }
  243 | 
  244 |     expect(workflowResults).toHaveLength(5);
  245 |     for (const result of workflowResults) {
  246 |       expect(result.startingStatus).not.toBe('');
  247 |       expect(result.endingStatus).not.toBe('');
  248 |       expect(result.actionsTaken.length).toBeGreaterThan(0);
  249 |     }
  250 |   });
  251 | });
  252 | 
```