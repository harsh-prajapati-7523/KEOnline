# Workflow Manager QA Report

Date: 2026-06-30  
Environment: https://test.kumar-electricals.com/  
User: SUPER_ADMIN_001  
Browser: Playwright Chromium, desktop viewport 1440x1000

## Summary

Workflow Manager loads for the super admin and the existing automated Workflow Management test passes.

The configured `Repair Workflow Test (REPAIR_WORKFLOW_TEST)` workflow cannot be activated. Initial validation was blocked because custom target statuses were inactive. After enabling `CUSTOM_NEW`, `CUSTOM_IN_PROGRESS`, and `CUSTOM_DONE`, and enabling the selected-category rule for the start transition, validation still reports `UNREACHABLE_WORKFLOW_FROM_NEW`.

Main bug found: validation appears not to treat an active custom status with `behaviorBucket: NEW` as a valid workflow start. The active transition `CUSTOM_NEW -> CUSTOM_IN_PROGRESS` remains rejected as unreachable from NEW.

## Test Commands Run

```bash
npx playwright test e2e/workflow-management.spec.js --project='Desktop Chromium' --reporter=line
```

Result: Passed, 1/1.

Exploratory Playwright/API checks were also run against the live test site to inspect validation, status state, category rules, and workflow config.

## Test Cases

| ID | Test case | Steps | Expected | Actual | Result |
| --- | --- | --- | --- | --- | --- |
| WM-001 | Super admin login | Open `/employee-login`; enter `SUPER_ADMIN_001`; enter password; click Login | User reaches employee dashboard | Dashboard loaded | Pass |
| WM-002 | Open Workflow Manager | Expand Administration Tools; click Workflow Management | Workflow Management page opens | Page opened with heading, category selector, tabs, readiness badges | Pass |
| WM-003 | Verify baseline automation | Run existing `workflow-management.spec.js` | Spec passes | `SUPER_ADMIN can configure a simple UI workflow` passed | Pass |
| WM-004 | Validate selected category before fixes | Select `Repair Workflow Test`; open Validation tab; click Run Validation | Validation shows blockers if config is incomplete | `INACTIVE_TARGET_STATUS` for transition IDs 1 and 2 | Pass |
| WM-005 | Enable inactive custom statuses | Open Statuses tab; enable `CUSTOM_NEW`, `CUSTOM_IN_PROGRESS`, `CUSTOM_DONE`; confirm each strong confirmation dialog | Statuses become active and validation refreshes | All three statuses active via API and UI confirmation messages shown | Pass |
| WM-006 | Validate after enabling statuses | Run validation again | Inactive-target blockers clear | Inactive-target blockers cleared; new blocker `UNREACHABLE_WORKFLOW_FROM_NEW` appears | Fail |
| WM-007 | Check category transition rules | Query category rules for transitions 1 and 2 | Start and complete transitions should be scoped/enabled for selected category | Transition 1 rule was disabled; transition 2 rule active | Config issue found |
| WM-008 | Enable start category rule and validate | Enable category rule for transition 1; run validation | Workflow should become ready if active path exists | Still `readyToActivate: false`; blocker remains `UNREACHABLE_WORKFLOW_FROM_NEW` | Fail |
| WM-009 | Check activation control | Review readiness state after validation | Activation only available when validation is ready | Activation remains blocked because validation is not ready | Pass |

## Current Workflow Evidence

Category:

```json
{
  "categoryId": 1,
  "categoryKey": "REPAIR_WORKFLOW_TEST",
  "workflowMode": "LEGACY_FIXED",
  "dbWorkflowEnabled": false,
  "fixedActionsEnabled": true
}
```

Statuses after test actions:

```json
[
  { "statusKey": "CUSTOM_NEW", "active": true, "behaviorBucket": "NEW", "terminal": false },
  { "statusKey": "CUSTOM_IN_PROGRESS", "active": true, "behaviorBucket": "IN_PROGRESS", "terminal": false },
  { "statusKey": "CUSTOM_DONE", "active": true, "behaviorBucket": "COMPLETED", "terminal": true }
]
```

Transitions:

```json
[
  { "id": 1, "actionKey": "START_SIMPLE_WORK", "fromStatusKey": "CUSTOM_NEW", "toStatusKey": "CUSTOM_IN_PROGRESS", "active": true },
  { "id": 2, "actionKey": "COMPLETE_SIMPLE_WORK", "fromStatusKey": "CUSTOM_IN_PROGRESS", "toStatusKey": "CUSTOM_DONE", "active": true }
]
```

Final validation result:

```json
{
  "valid": false,
  "readyToActivate": false,
  "blockingIssues": [
    {
      "code": "UNREACHABLE_WORKFLOW_FROM_NEW",
      "message": "Workflow has no active transition path from NEW",
      "transitionId": null
    }
  ],
  "warnings": [
    {
      "code": "MISSING_ROLE_TRANSITION_SCOPE_COVERAGE",
      "message": "Active transition is not scoped to any role",
      "transitionId": 1
    },
    {
      "code": "MISSING_ROLE_TRANSITION_SCOPE_COVERAGE",
      "message": "Active transition is not scoped to any role",
      "transitionId": 2
    }
  ]
}
```

## Bugs Found

### BUG-001: Custom NEW status is not accepted as workflow start

Severity: High  
Area: Workflow validation / activation readiness  

Steps:

1. Configure active statuses `CUSTOM_NEW`, `CUSTOM_IN_PROGRESS`, `CUSTOM_DONE`.
2. Ensure `CUSTOM_NEW` has `behaviorBucket: NEW`.
3. Configure active transition `CUSTOM_NEW -> CUSTOM_IN_PROGRESS`.
4. Enable selected category rule for the start transition.
5. Run category workflow validation.

Expected:

Validation should recognize `CUSTOM_NEW` as the start status because it is active and has behavior bucket `NEW`, or the UI should prevent creating such a custom start status if literal `NEW` is required.

Actual:

Validation returns `UNREACHABLE_WORKFLOW_FROM_NEW` and keeps `readyToActivate: false`.

Impact:

Custom workflows can be configured through the manager but cannot be activated even when a valid custom NEW-bucket path exists.

### BUG-002 / UX Issue: Role scope warning is not actionable enough

Severity: Medium  
Area: Validation / transition rule guidance

After category and status blockers were addressed, validation warns both active transitions are not scoped to any role. The page says creating a transition does not automatically enable category or role rules, but the validation warning does not clearly tell the admin which tab/control must be used next.

Impact:

Admins can reach a blocked/not-ready state without a clear guided remediation path.

## Artifacts

Screenshots captured:

- `01-workflow-manager-loaded.png`
- `02-validation-blocked-inactive-statuses.png`
- `03-statuses-enabled.png`
- `04-validation-after-status-enable.png`
- `error-state.png` from the exploratory script timeout/locator issue

Artifact directory:

`qa-artifacts/workflow-manager-2026-06-30/`

## Notes

State changes made in the test environment:

- Enabled `CUSTOM_NEW`.
- Enabled `CUSTOM_IN_PROGRESS`.
- Enabled `CUSTOM_DONE`.
- Enabled selected category rule for transition 1 (`START_SIMPLE_WORK`) through API after confirming the rule was disabled.

Activation was not completed because backend validation never reached `readyToActivate: true`.
