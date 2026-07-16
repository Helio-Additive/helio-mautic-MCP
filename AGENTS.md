# AGENTS.md

## Project Overview

This is Helio's local fork of a Mautic MCP server. Team members clone it locally and point Codex or Claude at the built `build/index.js` entrypoint.

This repository is not currently deployed as a package or service. Keep the workflow lightweight and optimized for local MCP use.

## Compatibility

- Tested target: Mautic 6.0.7.
- Keep existing API v2 / Mautic 7 code untouched unless the user explicitly asks to work on it.
- Prefer fixing Mautic 6.0.7 compatibility in the v1/FOSRestBundle paths when possible.
- Before changing request payload shapes, verify Mautic field aliases and endpoint expectations. The Mautic UI labels do not always match API field names.
- Campaign trigger API is unavailable on Mautic 6.0.7; keep `execute_campaign` guarded and do not imply it can execute campaigns on that version.
- Campaign clone/export/import are managed v1 flows for Mautic 6.0.7. Do not rely on native Mautic 7 campaign import/export routes for Mautic 6 compatibility.
- `update_campaign` is metadata-only. Use managed clone/import for structural event, source, form, or canvas changes.
- `create_campaign_with_automation` should validate campaign graph structure before sending payloads to Mautic and should default to unpublished unless explicitly requested.

## Local Commands

Use npm for the canonical commands:

```sh
npm install
npm run check
npm run build
```

If `just` is available, these wrappers are also supported:

```sh
just check
just build
just ready
```

## Completion Rules

Before calling code work complete:

1. Run `npm run check`.
2. Run `npm run build`.
3. If MCP behavior changed, remind the user to restart the Codex or Claude MCP server so it loads the rebuilt `build/index.js`.

For documentation-only changes, `npm run check` and `npm run build` are optional unless package scripts, TypeScript config, or generated output may have been affected.

## Versioning

Versioning is manual for now.

- Update `package.json`, `package-lock.json`, and `CHANGELOG.md` together when behavior changes.
- Use patch versions for bug fixes, such as `0.1.1`.
- Use minor versions for new tools or meaningful MCP behavior, such as `0.2.0`.
- Tags such as `v0.1.0` or `local-YYYY-MM-DD` may be used as known-good local checkpoints.

Do not add release automation, package publishing, or secret-based versioning unless the user explicitly asks for it.

## Change Scope

- Keep `main` stable.
- Use branches or PRs for fixes.
- Keep changes narrowly scoped to the MCP behavior requested.
- Do not perform the contact API audit fixes unless the user explicitly resumes that audit work.
