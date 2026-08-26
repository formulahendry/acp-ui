<script setup lang="ts">
import { ref } from 'vue';
import type { AuthMethod } from '@agentclientprotocol/sdk';
import { openExternalUrl } from '../lib/host';

defineProps<{
  authMethods: AuthMethod[];
  agentName: string;
}>();

const emit = defineEmits<{
  (e: 'select', methodId: string): void;
  (e: 'cancel'): void;
}>();

function handleSelect(method: AuthMethod) {
  // Open the embedded auth URL (if any) in a new tab AND close the popup at
  // once — clicking anywhere on the item does both, matching what users
  // expect from the device-authorization instructions.
  const url = extractUrl(method.description);
  if (url) {
    // Host-aware: system browser on Tauri desktop, new tab on web.
    void openExternalUrl(url);
  }
  emit('select', method.id);
}

/**
 * Split a description into plain-text and URL segments so URLs (e.g. the
 * device-authorization link many agents embed in their auth instructions)
 * render as clickable links that open in a new tab, instead of forcing the
 * user to copy/paste them by hand.
 */
type Segment = { type: 'text'; value: string } | { type: 'link'; value: string };

const URL_RE = /(https?:\/\/[^\s]+)/g;

/** First URL embedded in a description, or null. */
function extractUrl(description?: string | null): string | null {
  if (!description) return null;
  return description.match(URL_RE)?.[0] ?? null;
}

function toSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_RE)) {
    const url = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) });
    }
    segments.push({ type: 'link', value: url });
    lastIndex = start + url.length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}

/**
 * Pull the device-authorization user code out of a description. Agents embed
 * it both in the URL (`?user_code=XXXX`) and inline (`(code XXXX)`); try the
 * URL form first, then the inline form. Returns null when there's no code.
 */
function extractCode(description?: string | null): string | null {
  if (!description) return null;
  return (
    description.match(/user_code=([A-Za-z0-9-]+)/)?.[1] ??
    description.match(/\bcode\s+([A-Za-z0-9-]{4,})/i)?.[1] ??
    null
  );
}

// The code most recently copied, so we can show a transient "Copied!" label.
const copiedCode = ref<string | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    copiedCode.value = code;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copiedCode.value = null;
    }, 2000);
  } catch (e) {
    console.warn('Failed to copy code to clipboard:', e);
  }
}
</script>

<template>
  <div class="auth-overlay" @click.self="emit('cancel')">
    <div class="auth-dialog">
      <div class="dialog-header">
        <h3>Authentication Required</h3>
        <button class="close-btn" @click="emit('cancel')">✕</button>
      </div>
      
      <div class="dialog-content">
        <p class="description">
          <strong>{{ agentName }}</strong> requires authentication to continue.
          Select an authentication method:
        </p>
        
        <div class="auth-methods">
          <button
            v-for="method in authMethods"
            :key="method.id"
            class="auth-method-btn"
            @click="handleSelect(method)"
          >
            <div class="method-info">
              <span class="method-name">{{ method.name }}</span>
              <span v-if="method.description" class="method-desc">
                <template v-for="(seg, i) in toSegments(method.description)" :key="i">
                  <a
                    v-if="seg.type === 'link'"
                    :href="seg.value"
                    class="method-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    @click.prevent
                  >{{ seg.value }}</a>
                  <template v-else>{{ seg.value }}</template>
                </template>
              </span>
              <button
                v-if="extractCode(method.description)"
                type="button"
                class="copy-code-btn"
                @click.stop="copyCode(extractCode(method.description)!)"
              >
                {{ copiedCode === extractCode(method.description) ? '✓ Copied!' : `Copy code ${extractCode(method.description)}` }}
              </button>
            </div>
            <span class="arrow">→</span>
          </button>
        </div>
      </div>
      
      <div class="dialog-footer">
        <button class="cancel-btn" @click="emit('cancel')">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.auth-dialog {
  background: var(--bg-main);
  border-radius: 8px;
  width: 90%;
  max-width: 420px;
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

.description {
  margin: 0 0 1rem 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.auth-methods {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.auth-method-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-sidebar);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.auth-method-btn:hover {
  border-color: var(--bg-primary);
  background: var(--bg-hover);
}

.method-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.method-name {
  font-weight: 500;
  color: var(--text-primary);
}

.method-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
  word-break: break-word;
}

.method-link {
  color: var(--bg-primary);
  text-decoration: underline;
  cursor: pointer;
}

.method-link:hover {
  text-decoration: none;
}

.copy-code-btn {
  align-self: flex-start;
  margin-top: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-main);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  cursor: pointer;
  transition: all 0.15s ease;
}

.copy-code-btn:hover {
  border-color: var(--bg-primary);
  color: var(--text-primary);
}

.arrow {
  font-size: 1.25rem;
  color: var(--text-muted);
}

.auth-method-btn:hover .arrow {
  color: var(--bg-primary);
}

.dialog-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
}

.cancel-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.9rem;
}

.cancel-btn:hover {
  background: var(--bg-hover);
}
</style>
