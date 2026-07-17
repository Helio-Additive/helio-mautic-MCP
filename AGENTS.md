# AGENTS.md

## Project Overview

This is Helio's local fork of a Mautic MCP server. Team members clone it locally and point Codex or Claude at the built `build/index.js` entrypoint.

This repository is not currently deployed as a package or service. Keep the workflow lightweight and optimized for local MCP use.

## Compatibility

- Tested target: Mautic 6.0.7.
- Keep existing API v2 / Mautic 7 code untouched unless the user explicitly asks to work on it.
- Prefer fixing Mautic 6.0.7 compatibility in the v1/FOSRestBundle paths when possible.
- Before changing request payload shapes, verify Mautic field aliases and endpoint expectations. The Mautic UI labels do not always match API field names.
- Audited v1 list/search tools should return a `pagination` object with `total`, `start`, `limit`, `count`, `hasMore`, and `nextStart` when the endpoint supports paging.
- Audited v1 mutation tools should return `success`, `action`, `id`, and one normalized entity summary key such as `contact`, `campaign`, `segment`, or `file`.
- Campaign trigger API is unavailable on Mautic 6.0.7; keep `execute_campaign` guarded and do not imply it can execute campaigns on that version.
- Campaign clone/export/import are managed v1 flows for Mautic 6.0.7. Do not rely on native Mautic 7 campaign import/export routes for Mautic 6 compatibility.
- `update_campaign` is metadata-only. Use managed clone/import for structural event, source, form, or canvas changes.
- `create_campaign_with_automation` should validate campaign graph structure before sending payloads to Mautic and should default to unpublished unless explicitly requested.
- Email list/detail tools should avoid returning large `customHtml` and `plainText` bodies by default. Require `includeContent: true` when callers need body content.
- On Mautic 6.0.7, prefer `get_email_stats_v6` and `get_email_graph_stats_v6` when `/emails/{id}/stats` is unavailable.
- Form list/detail tools should default to compact metadata and summarized fields/actions. Use `includeRaw: true` only when raw builder internals are needed.
- New forms created through the MCP should default to unpublished unless the caller explicitly requests publication.
- Asset and page list/detail tools should avoid returning file contents or page HTML by default. Require `includeRaw: true` or `includeContent: true` when callers need heavy content.
- New assets and pages created through the MCP should default to unpublished unless explicitly published.
- For local asset creation on Mautic 6.0.7, upload filesystem paths through `/files/media/new` first and pass the returned filename as the asset `file` value. The file upload route only accepts `media` or `images`, not `assets`.
- Webhook and report list/detail tools should default to compact/sanitized output. Do not expose webhook secrets unless `includeRaw: true` is explicitly requested.
- New webhooks and reports created through the MCP should default to unpublished unless explicitly published.
- `upload_file` should default to the `media` folder on Mautic 6.0.7 because file uploads accept `media` or `images`, not `assets`.
- Webhook and report create/update/delete flows are live-tested with disposable unpublished records on Mautic 6.0.7.

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
