# Changelog

## 0.1.1

- Fixed `get_segment_contacts` for Mautic 6.0.7 by resolving the segment alias and using contact search with `segment:<alias>`.
- Added normalized contact output for `get_contact`, `search_contacts`, and `get_segment_contacts`.
- Added optional field alias filtering for compact contact responses.
- Preserved explicit `0` and `false` query parameters in audited v1 contact, segment, and business tools.
- Switched contact tag add/remove operations to the v1 contact edit endpoint pattern; live verification still requires a disposable test contact.

## 0.1.0

- Established this as Helio's local Mautic MCP fork.
- Documented Mautic 6.0.7 as the tested compatibility target.
- Documented that API v2 / Mautic 7 code should be left untouched unless explicitly required.
- Fixed contact first and last name updates by mapping MCP `firstName` / `lastName` input to Mautic contact field aliases.
