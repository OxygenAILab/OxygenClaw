# Changelog

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->

All notable changes to OxygenClaw are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com); versioning follows the
organization scheme `v{Year}.{Major}-Alpha {AlphaVer.}`.

> 中文说明：本文件记录 OxygenClaw 的全部显著变更。版本号遵循组织规范
> `v{Year}.{Major}-Alpha {AlphaVer.}`；正式发布需 SSH 签名。

## [Unreleased] — v26.0 branch (theme: WebUI Regression 回归 WebUI)

Work is developed on `feature/webui-regression`; it will be folded into
`v26.0-Alpha 2` when the theme completes.

### Added
- **NewAPI quota_data adoption (rc.27 study)**: Dashboard now prefers the
  pre-aggregated `/api/data/self` endpoint (model x day, 30-day window,
  exact counts) for daily/model cost stats; monthCost card gains full-window
  accuracy, log endpoint kept for token totals and as fallback.
- **UI crawl takeaways**: collapsible sidebar (64px icon rail <-> 240px,
  300ms transition, persisted) and hotkey-hint slots adopted from crawled
  Doubao/Qianwen layout structures; timed-task entry and tiptap composer
  recorded as future items.
- **UI remake round 3**: Doubao-style account center dialog (avatar, local
  badge, profile/settings/theme/sign-out); conversations support pinning
  and date-grouped lists (Pinned / Today / Last 7 days / Older).
- **UI remake round 2**: model dropdown rebuilt with provider groups,
  capability badges, context-window hints and selection checkmark;
  ComputerUse permission control (always-ask / confirm-risky / allow-all)
  persisted to settings — UI-first for a future backend approval API.
- **UI remake round 1**: dark-by-default theme (fresh profiles; user
  choice persists); conversation composer now carries the same controls
  as the empty-state hero input (capability pills, attachments, current
  model button) per Doubao/Qwen references.
- **Marketplace multi-source registry**: add/enable/disable/delete skill
  sources (built-in OpenClawMP + arbitrary JSON endpoints returning
  `{skills:[...]}`); aggregated listings with per-source badges and
  graceful partial-failure handling; JSON-source skills import to local
  in one click without the CLI.
- **Dashboard data-source badge**: header always shows the active source
  (NewAPI / custom API / local stats).
- **NewAPI data source for Dashboard**: adapter (`services/newapi.ts`) for
  NewAPI v1.0.0-rc.24 JWT auth; aggregates `/api/user/self`,
  `/api/log/self/stat`, `/api/log/self` into DashboardStats (balance,
  RPM/TPM, token totals, per-model & daily breakdowns). Credentials accept
  `user:pass`, `userId:systemToken` (with `New-Api-User` header), or a bare
  token. All calls are proxied server-side to avoid CORS.
- **Pull model list from NewAPI sites**: deploy dialog can fetch
  `/api/user/models` and tick-import models instead of typing names.
- **Skill import via .zip** (Marketplace): unpacks with JSZip and
  auto-analyzes `SKILL.md` frontmatter (agent-skills standard), then
  `manifest.json`, then aggregates text files; legacy `.json` path kept.
- **Deploy presets**: one-click endpoint presets for OpenAI / Anthropic /
  Gemini / NewAPI / SiliconFlow / Volcano Ark / Ali Bailian / 无问芯穹 /
  OpenCode Zen.
- **Playgrounds empty-state redesign**: centered greeting + hero input with
  inline capability pills, attachment actions and mode-aware suggestion
  chips (modeled after Doubao/Qwen patterns).
- Mobile sidebar: hamburger button + overlay drawer below `lg` breakpoint.
- MCP: Agent IDs are auto-generated (regenerable), input is read-only.

### Fixed
- Transparent modals/cards app-wide: `--md-surface-container-*` tiers were
  missing from the light `:root` block and defined **after** the closing
  brace of the apple-dark block (orphan declarations dropped by CSS).
  Mapped into Tailwind config as `surface.container.*`; fixed 11 components
  (Dialog, Card, Button, Dropdown, Toggle, Slider, …).
- Material-light/dark blocks restored to their intended MD3 purple palette
  (previously mistaken for contamination of the mono theme).
- Settings page layout: removed `-m-6` negative-margin hack that pushed the
  page under the Header; content column widened to `max-w-3xl`.
- `/workbench` now redirects to `/playgrounds` (duplicate chat UI retired;
  it also hardcoded a modelId, ignoring user selection).
- Language switch was inert: header user menu and Dashboard/Models titles
  now read from i18n dictionaries.
- Task history: hidden in chat mode; slide-down animation; resizable height.
- Playgrounds mode segmented control: content-fit width, no glow in dark.
- Top bar shows the current session title instead of capability pills.
- Dashboard legacy `[object Object]` render when `totalTokens` was
  `{input:0, output:0}` (`0+0 || obj` short-circuit).
- Server proxy route: `authMiddleware` → `optionalAuth` (local tool with
  SSRF guards in place; unauthenticated local mode could never proxy).
- Server now listens on `localhost` only (was all interfaces) so the
  unauthenticated proxy is not reachable from the LAN.

### Known limitations
- NewAPI quota→USD factor is hardcoded (500000); site-configurable in NewAPI
  itself.
- `user:password` credential form cannot contain a colon in the password;
  prefer system access tokens in that case.
- NewAPI connection credentials are stored in plain localStorage —
  acceptable for a single-machine tool; must move to server-side encrypted
  storage before any multi-user/remote deployment.

### Open items (planned for v26.0)
- MCP task node graph (list view stays as option)
- Marketplace multi-source beyond openclawmp.stepfun.com; skill/MCP source
  abstraction
- Dashboard data-source abstraction (local history / NewAPI / Sub2API /
  custom JSON)
- UI remake rounds per Doubao/Qwen references: dark-by-default + composer
  toolbar unification; model dropdown with descriptions + permission
  control; account center + conversation management
- CodeX Harness study (research task)

<!--
Historical note: the codebase was recovered from the legacy workspace
archive (2026-08-12) and re-baselined; earlier history is not represented
in this file. See memory/FACT.md for the inherited context.
-->
