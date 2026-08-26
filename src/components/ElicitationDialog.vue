<script setup lang="ts">
import type { ElicitationRequest, ElicitationAction } from '../lib/types';
import { openExternalUrl } from '../lib/host';

defineProps<{
  elicitation: ElicitationRequest;
}>();

const emit = defineEmits<{
  (e: 'respond', action: ElicitationAction): void;
}>();

/**
 * Split text into plain-text and URL segments so any URL embedded in the
 * elicitation message renders as a clickable link. Mirrors the helper in
 * AuthMethodDialog.
 */
type Segment = { type: 'text'; value: string } | { type: 'link'; value: string };
const URL_RE = /(https?:\/\/[^\s]+)/g;

function toSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_RE)) {
    const url = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) segments.push({ type: 'text', value: text.slice(lastIndex, start) });
    segments.push({ type: 'link', value: url });
    lastIndex = start + url.length;
  }
  if (lastIndex < text.length) segments.push({ type: 'text', value: text.slice(lastIndex) });
  return segments;
}

/** Open the authorization URL in the system browser (Tauri) or a new tab
 * (web), without dismissing the dialog. */
function openUrl(url: string) {
  void openExternalUrl(url);
}
</script>

<template>
  <div class="elicit-overlay" @click.self="emit('respond', 'cancel')">
    <div class="elicit-dialog">
      <div class="dialog-header">
        <h3>Authorization Required</h3>
        <button class="close-btn" title="Cancel" @click="emit('respond', 'cancel')">✕</button>
      </div>

      <div class="dialog-content">
        <p class="message">
          <template v-for="(seg, i) in toSegments(elicitation.message)" :key="i">
            <a
              v-if="seg.type === 'link'"
              :href="seg.value"
              class="msg-link"
              target="_blank"
              rel="noopener noreferrer"
              @click.prevent="openUrl(seg.value)"
            >{{ seg.value }}</a>
            <template v-else>{{ seg.value }}</template>
          </template>
        </p>

        <button class="open-url-btn" @click="openUrl(elicitation.url)">
          Open authorization page ↗
        </button>

        <p class="hint">
          Authorize in the page that opens; the turn continues automatically
          once it's done. If it doesn't, use <strong>I've authorized</strong>.
        </p>
      </div>

      <div class="dialog-footer">
        <button class="decline-btn" @click="emit('respond', 'decline')">Decline</button>
        <button class="accept-btn" @click="emit('respond', 'accept')">I've authorized</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.elicit-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.elicit-dialog {
  background: var(--bg-main);
  border-radius: 8px;
  width: 90%;
  max-width: 440px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.125rem;
}

.close-btn {
  border: none;
  background: transparent;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0.25rem;
}

.close-btn:hover {
  color: var(--text-primary);
}

.dialog-content {
  padding: 1.25rem;
}

.message {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
  font-size: 0.9rem;
  line-height: 1.5;
  word-break: break-word;
}

.msg-link {
  color: var(--bg-primary);
  text-decoration: underline;
}

.msg-link:hover {
  text-decoration: none;
}

.open-url-btn {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--bg-primary);
  border-radius: 6px;
  background: var(--bg-primary);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.open-url-btn:hover {
  opacity: 0.9;
}

.hint {
  margin: 0.75rem 0 0 0;
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.4;
}

.dialog-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.decline-btn,
.accept-btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.decline-btn {
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
}

.decline-btn:hover {
  background: var(--bg-hover);
}

.accept-btn {
  border: 1px solid var(--bg-primary);
  background: var(--bg-primary);
  color: #fff;
}

.accept-btn:hover {
  opacity: 0.9;
}
</style>
