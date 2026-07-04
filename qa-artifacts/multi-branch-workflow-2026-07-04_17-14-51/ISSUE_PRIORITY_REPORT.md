# Multi-Branch Workflow Issue Priority Report

Date: 2026-07-04  
Source run: `qa-artifacts/multi-branch-workflow-2026-07-04_17-14-51`

## Priority List

### P0 - Custom-role workflow actions fail to load

Status: Fix applied, verification pending  
Area: Backend  
Observed API: `GET /volt/tickets/{id}/available-actions`  
Observed result: `500 Internal Server Error` for custom role `QA_ALPHA_JUL04_1740`  
Correlation ID: `258c879e-dab2-4e3f-aabb-bc985ed8a3cd`

Impact:
- Custom role users cannot see allowed workflow actions.
- This blocks the core test goal: different users following different paths for the same category.

Evidence:
- SUPER_ADMIN could load actions for the same ticket.
- Custom-role ticket detail showed: `Unable to load available workflow actions. Please refresh the ticket.`

Likely cause:
- Expected permission denials are thrown as `ResponseStatusException` inside transactional access checks while building available actions.
- The caller catches these to hide unavailable actions, but the transaction can still be marked rollback-only and surface as 500.

Progress:
- Updated `AccessService.requireAllowed(...)` and `requireAnyAllowed(...)` with `noRollbackFor = ResponseStatusException.class`.
- Purpose: permission denials used while hiding unavailable workflow actions should not poison the surrounding read transaction.
- Verification pending by request: no build/test run.

### P1 - `/tickets/open` endpoint returns 500

Status: Fix applied, verification pending  
Area: Backend / Routing  
Observed API: `GET /volt/tickets/open`  
Observed result:

```json
{
  "message": "An internal error occurred",
  "correlationId": "ecbc5b63-9e58-44cd-aa81-1964a255a777"
}
```

Impact:
- Open ticket list can fail.
- This can break ticket discovery for users.

Likely cause:
- `/open` can be handled by generic ticket-id mappings if route matching falls through to `/{id}` handlers.

Progress:
- Constrained ticket-id controller mappings to numeric ids with `/{id:\d+}`.
- This prevents literal paths such as `/volt/tickets/open` from being parsed as ticket ids.
- Verification pending by request: no build/test run.

### P1 - Workflow Builder can retain terminal flag on edited seeded rows

Status: Fix applied, verification pending  
Area: Frontend  
Observed behavior:
- A seeded row originally targeting `Default Done` retained the terminal target behavior after the target was changed to an intermediate custom status.
- Resulting status became terminal and then failed as a source:
  `Terminal status cannot be used as From Status.`

Impact:
- Users can accidentally create an invalid workflow by editing a seeded/default row.

Recommended fix:
- In Edit Workflow Path, clear `toStatusTerminal` automatically when the target status text changes away from an existing terminal status.
- Show bucket/terminal warning before save.

Progress:
- Updated `WorkflowBuilder.updateRow(...)` so changing `To Status` resets `toStatusTerminal` based on the newly selected target status.
- If the selected target is an existing terminal status, the flag stays true.
- If the user changes away to a new/intermediate target, stale terminal state is cleared.
- Verification pending by request: no build/test run.

### P2 - Workflow Management did not expose Edit Workflow Path on test deployment

Status: Investigated, no code change  
Area: Frontend / Deployment parity  
Observed behavior:
- Test deployment showed Workflow Management tabs and existing transitions, but no visible `Edit Workflow Path` / `Build Workflow` button.
- Direct route `/admin/workflow/builder?categoryId=...` worked.

Impact:
- Users may not discover the workflow builder from the UI.

Progress:
- Current local source already exposes `Edit Workflow Path` / `Build Workflow` from the overview and transitions areas.
- Test deployment did not show it during the run, so this appears to be deployment parity or stale deployed assets.
- No code change made.

### P2 - Default Start action remains exposed with custom branch actions

Status: Pending  
Area: Product / Workflow configuration  
Observed behavior:
- SUPER_ADMIN saw `Start`, `QA Route Alpha...`, and `QA Route Beta...` on the same NEW ticket.

Impact:
- Default path remains available unless explicitly disabled/restricted.
- It can confuse branch testing and production workflow design.

Recommended fix:
- Make default transitions easy to disable from the category workflow screen, or add a warning when custom NEW branches coexist with default start.

Progress:
- Not started.

### P3 - Validation warnings for missing transition role scopes

Status: Documented  
Area: Workflow configuration  
Observed behavior:
- Validation passed, but warned that transition-specific role scope was missing.

Impact:
- Not blocking when action permission is configured.
- It means action permission alone controls visibility unless transition role scope is added.

Progress:
- Documented as expected warning for this test design.

## Verification Status

No build or tests have been run after fixes because the instruction was: `Do not build or test`.
