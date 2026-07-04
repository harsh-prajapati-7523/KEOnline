# Multi-Branch Workflow UI Test

Date: 2026-07-04  
Environment: https://test.kumar-electricals.com

## Purpose

Verify whether two different users, each with a different custom role, can follow different workflow paths for tickets in the same ticket category.

## Records Created

- Category: QA Multi Branch JUL04_1740 (`QA_MB_CAT_JUL04_1740`)
- Role 1: QA Alpha JUL04_1740 (`QA_MB_ALPHA_JUL04_1740`)
- Role 2: QA Beta JUL04_1740 (`QA_MB_BETA_JUL04_1740`)
- User 1: QA Alpha User JUL04_1740 (`QA_ALPHA_JUL04_1740`)
- User 2: QA Beta User JUL04_1740 (`QA_BETA_JUL04_1740`)
- Alpha test ticket: KE-012, ticket id 11
- Beta test ticket: KE-013, ticket id 12

## Workflow Path

- `Default New` -> `QA Alpha Work JUL04_1740` using `QA Route Alpha JUL04_1740`
- `QA Alpha Work JUL04_1740` -> `Default Done` using `QA Finish Alpha JUL04_1740`
- `Default New` -> `Default Done` using `QA Route Beta JUL04_1740`

Backend validation result for category id 7:

- `valid: true`
- `readyToActivate: true`
- blocking issues: none

## Step-by-Step Evidence

1. Open employee dashboard as SUPER_ADMIN.  
   Screenshot: [00-dashboard.png](screenshots/00-dashboard.png)

2. Create the new ticket category.  
   Screenshot: [01-category-created.png](screenshots/01-category-created.png)

3. Create two custom roles.  
   Screenshot: [02-roles-created.png](screenshots/02-roles-created.png)

4. Configure Role Access Management for Alpha role.  
   Screenshot: [02-role-access-QA_MB_ALPHA_JUL04_1740.png](screenshots/02-role-access-QA_MB_ALPHA_JUL04_1740.png)

5. Configure Role Access Management for Beta role.  
   Screenshot: [02-role-access-QA_MB_BETA_JUL04_1740.png](screenshots/02-role-access-QA_MB_BETA_JUL04_1740.png)

6. Create two users, one assigned to each role.  
   Screenshot: [03-users-created.png](screenshots/03-users-created.png)

7. Build the multi-branch workflow path in Edit Workflow Path / Workflow Builder.  
   Screenshot: [04-workflow-builder-path.png](screenshots/04-workflow-builder-path.png)

8. Save the workflow path.  
   Screenshot: [05-workflow-builder-saved.png](screenshots/05-workflow-builder-saved.png)

9. Configure workflow action access by role.  
   Alpha role was granted Alpha actions. Beta role was granted Beta action.  
   Screenshot: [06-workflow-role-access.png](screenshots/06-workflow-role-access.png)

10. Confirm DB workflow is active for the category.  
    Screenshot: [07-workflow-active.png](screenshots/07-workflow-active.png)

11. Create Alpha test ticket in the same category.  
    Screenshot: [08-ticket-alpha-created.png](screenshots/08-ticket-alpha-created.png)

12. Create Beta test ticket in the same category.  
    Screenshot: [08-ticket-beta-created.png](screenshots/08-ticket-beta-created.png)

## Runtime Result

The setup completed and the category workflow validates successfully, but end-user workflow execution is currently blocked.

When logging in as `QA_ALPHA_JUL04_1740` and opening ticket `KE-010` / id `9`, the ticket detail page loaded but showed:

`Unable to load available workflow actions. Please refresh the ticket.`

Screenshot: [debug-alpha-ticket-runtime.png](screenshots/debug-alpha-ticket-runtime.png)

The failing API call was:

`GET /volt/tickets/9/available-actions`

Response:

```json
{
  "message": "An internal error occurred",
  "correlationId": "258c879e-dab2-4e3f-aabb-bc985ed8a3cd"
}
```

SUPER_ADMIN can load available actions for the same ticket and sees:

- `Start`
- `QA Route Alpha JUL04_1740`
- `QA Route Beta JUL04_1740`

So the workflow is configured, but custom-role runtime action loading is failing.

## Conclusion

The UI setup proves the category, roles, users, role permissions, and multi-branch workflow can be created. The final user-path execution test is blocked by a backend 500 in available workflow actions for custom roles.

Next fix should target `GET /volt/tickets/{id}/available-actions` for custom roles, then rerun the final Alpha/Beta user execution screenshots.
