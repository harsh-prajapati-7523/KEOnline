# Multi-Branch Workflow UI Test

Date: 2026-07-04
Environment: https://test.kumar-electricals.com

## Records Created

- Category: QA Multi Branch JUL04_1740 (QA_MB_CAT_JUL04_1740)
- Role 1: QA Alpha JUL04_1740 (QA_MB_ALPHA_JUL04_1740)
- Role 2: QA Beta JUL04_1740 (QA_MB_BETA_JUL04_1740)
- User 1: QA Alpha User JUL04_1740 (QA_ALPHA_JUL04_1740)
- User 2: QA Beta User JUL04_1740 (QA_BETA_JUL04_1740)
- Ticket 1: https://test.kumar-electricals.com/tickets/13
- Ticket 2: https://test.kumar-electricals.com/tickets/14

## Workflow Shape

- Default New -> QA Alpha Work JUL04_1740 by QA Route Alpha JUL04_1740
- Default New -> Default Done by QA Route Beta JUL04_1740
- QA Alpha Work JUL04_1740 -> Default Done by QA Finish Alpha JUL04_1740

## Result

- QA Alpha JUL04_1740 could see and execute only the Alpha branch actions.
- QA Beta JUL04_1740 could see and execute only the Beta branch actions.
- The same category supports different workflow paths for different users through role/action permissions.

## Step Screenshots

1. Open employee dashboard as SUPER_ADMIN
   - Starting point for the UI setup.
   - Screenshot: [00-dashboard.png](screenshots/00-dashboard.png)
2. Create the new ticket category
   - Category: QA Multi Branch JUL04_1740
   - Screenshot: [01-category-created.png](screenshots/01-category-created.png)
3. Create two new roles
   - QA_MB_ALPHA_JUL04_1740 and QA_MB_BETA_JUL04_1740
   - Screenshot: [02-roles-created.png](screenshots/02-roles-created.png)
4. Manage Role Access for QA Alpha JUL04_1740
   - Base dashboard and ticket access enabled.
   - Screenshot: [02-role-access-QA_MB_ALPHA_JUL04_1740.png](screenshots/02-role-access-QA_MB_ALPHA_JUL04_1740.png)
5. Manage Role Access for QA Beta JUL04_1740
   - Base dashboard and ticket access enabled.
   - Screenshot: [02-role-access-QA_MB_BETA_JUL04_1740.png](screenshots/02-role-access-QA_MB_BETA_JUL04_1740.png)
6. Create two users
   - One user assigned to each created role.
   - Screenshot: [03-users-created.png](screenshots/03-users-created.png)
7. Build a multi-branch workflow path
   - Two branch-start actions leave the same NEW status.
   - Screenshot: [04-workflow-builder-path.png](screenshots/04-workflow-builder-path.png)
8. Save the workflow path
   - The selected first/source status is saved as NEW.
   - Screenshot: [05-workflow-builder-saved.png](screenshots/05-workflow-builder-saved.png)
9. Configure workflow action access by role
   - Alpha has Alpha actions; Beta has Beta actions.
   - Screenshot: [06-workflow-role-access.png](screenshots/06-workflow-role-access.png)
10. Activate DB workflow for the category
   - Category uses the configured DB workflow.
   - Screenshot: [07-workflow-active.png](screenshots/07-workflow-active.png)
11. Create Alpha test ticket
   - Ticket URL: https://test.kumar-electricals.com/tickets/13
   - Screenshot: [08-ticket-alpha-created.png](screenshots/08-ticket-alpha-created.png)
12. Create Beta test ticket
   - Ticket URL: https://test.kumar-electricals.com/tickets/14
   - Screenshot: [08-ticket-beta-created.png](screenshots/08-ticket-beta-created.png)
13. QA Alpha JUL04_1740 sees only its branch start action
   - QA Route Alpha JUL04_1740 is visible; QA Route Beta JUL04_1740 is hidden.
   - Screenshot: [09-QA_MB_ALPHA_JUL04_1740-start-actions.png](screenshots/09-QA_MB_ALPHA_JUL04_1740-start-actions.png)
14. QA Alpha JUL04_1740 follows its branch
   - QA Finish Alpha JUL04_1740 is visible after entering QA Alpha Work JUL04_1740.
   - Screenshot: [10-QA_MB_ALPHA_JUL04_1740-finish-action.png](screenshots/10-QA_MB_ALPHA_JUL04_1740-finish-action.png)
15. QA Alpha JUL04_1740 completes its branch
   - Ticket reaches Default Done.
   - Screenshot: [11-QA_MB_ALPHA_JUL04_1740-completed.png](screenshots/11-QA_MB_ALPHA_JUL04_1740-completed.png)
16. QA Beta JUL04_1740 sees only its branch start action
   - QA Route Beta JUL04_1740 is visible; QA Route Alpha JUL04_1740 is hidden.
   - Screenshot: [09-QA_MB_BETA_JUL04_1740-start-actions.png](screenshots/09-QA_MB_BETA_JUL04_1740-start-actions.png)
17. QA Beta JUL04_1740 completes its branch
   - Ticket reaches Default Done.
   - Screenshot: [11-QA_MB_BETA_JUL04_1740-completed.png](screenshots/11-QA_MB_BETA_JUL04_1740-completed.png)
