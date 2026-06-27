# Project Instructions

## Workflow

- Always inspect the latest `main` branch before editing.
- Do not rely only on chat memory or old pull-request branches.
- Create one new branch and one pull request for each functional change.
- Never merge a pull request automatically.
- The user tests and merges pull requests manually.
- Do not begin implementation until the requested gameplay rules are clear.
- Treat the user's stated design as authoritative. Do not infer intended design from existing code.

## Scope

- Make the smallest change that fully solves the requested problem.
- Prefer modifying no more than 3 production files per task.
- Explain why before modifying more files.
- Do not refactor unrelated systems.
- Do not rename unrelated variables, files, skills, or systems.
- Do not change balance values unless explicitly requested.
- Do not rewrite an entire file when a local edit is sufficient.
- Remove obsolete code introduced or replaced by the same change.

## Gameplay Rules

- Every skill must work when obtained independently.
- Skills must not require prerequisite skills to appear in rewards.
- Choosing one archetype may increase the probability of related skills, but must not block other archetypes.
- Do not add, remove, or redesign gameplay mechanics without explicit approval.
- Test normal enemies, elite enemies, and bosses separately when behavior differs.
- Failed skill casts must not consume cooldown unless explicitly designed to do so.
- Skills must not apply effects to dead or invalid targets.
- Event handlers may synchronously kill, destroy, transfer, or clear targets.
- Save mutable target references before dealing damage, and do not assume the reference remains unchanged afterward.
- Every event listener, updater, tween, visual, and runtime object must be cleaned up when the skill is removed or the scene shuts down.

## UI and Visual Rules

- Check whether later UI refreshes overwrite newly displayed values.
- Keep status indicators stable when other UI elements update.
- Visual effects must not follow the player as a fallback unless explicitly designed to do so.
- Visual position, readability, and game feel require manual testing and must be listed in the pull request.

## Validation

- Add a behavioral regression test for every reported bug.
- Tests must reproduce the real failure path, not only search source text.
- Cover relevant edge cases such as:
  - target death during damage;
  - no replacement target;
  - replacement target available;
  - boss immunity;
  - skill obtained without related skills;
  - cleanup and rebinding.
- Run `npm run build`.
- Run the validation for the changed system.
- Run related existing regression tests.
- Run all validation scripts before marking the pull request ready.
- Do not weaken or delete a valid test merely to make a change pass.
- Update stale version-only assertions when the version is intentionally bumped.
- Temporary GitHub Actions workflows must be removed before delivery.

## Pull Request Delivery

The final report must include:

- version number;
- changed production files;
- changed behavior;
- behavior intentionally left unchanged;
- tests and build commands run;
- automated test results;
- manual checks still required;
- pull-request URL.

Keep the pull request open and do not merge it.
