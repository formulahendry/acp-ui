# Learnings

## [2026-04-12] Initial Context
- Repo uses `vue-tsc --noEmit && vite build` as build script
- No test infrastructure exists — zero tests, no vitest, no @vue/test-utils
- TypeScript strict mode with noUnusedLocals/noUnusedParameters
- `@tauri-apps/plugin-dialog` already a dependency (used in App.vue:67-80 for folder picker)
- `@tauri-apps/plugin-fs` already a dependency (stat() available for file size validation)
- ACP SDK `@agentclientprotocol/sdk` v0.13.1 — PromptRequest.prompt accepts Array<Content>
- acp-bridge.ts already imports PromptRequest type and has prompt() method that passes through
- sendPrompt() in session.ts:579-621 creates text-only prompt with `[{type:'text', text}]`
- ChatMessage type in types.ts:38-45 has id, role, content, thought?, timestamp, toolCalls?
- vite.config.ts uses async config function pattern
- CI workflow has "Type check" (npm run build) then "Build Tauri app" steps
- Vitest setup works with async `defineConfig(async () => ({ ... }))` when the `/// <reference types="vitest/config" />` directive is added at the top of `vite.config.ts`
- `happy-dom` is sufficient for the smoke test and keeps the test environment lightweight
- Tauri plugin modules can be fully mocked in `src/test-setup.ts` with `vi.mock()` so tests do not require the native runtime
[2026-04-12] Attachment validation
- Added pure utility module for attachment metadata validation with extension, size, count, and dedup checks.
- Validation uses case-insensitive path normalization for v1, matching the planned shared contract.
- Vitest coverage includes valid sets, disallowed extensions, oversized files, duplicate paths, over-count, mixed results, and MIME mapping.
- Test setup already exists, so the new test file runs without extra config.
\n+[2026-04-12] File picker adapter
- Added a mockable `_rawPicker` seam plus `_setRawPicker`/`_resetRawPicker` helpers so tests can bypass native dialogs.
- `pickFiles()` normalizes `open({ multiple: true })` results into `AttachmentRef[]`, derives names from path separators, and safely falls back to `size = 0` when `stat()` fails.
- Test coverage verifies multi-file, single-file, cancel/null, empty selection, and stat failure behavior.
- Centralized AttachmentRef -> ACP resource_link serialization in src/lib/attachments.ts to keep file URI encoding consistent across callers.
- ACP PromptRequest content blocks accept resource_link with nested resource { uri, name, mimeType }, so session prompt payloads can carry attachment metadata without file content.
- Windows drive-letter paths are safely serialized with encodeURIComponent on path segments, yielding file:///C%3A/... URIs.

- ACP esource_link content blocks use flat top-level fields (uri, name, mimeType); nesting under esource breaks vue-tsc/build even if tests pass.
- The serializer should mirror the SDK's ContentBlock union exactly to keep type-checking aligned with runtime payloads.

