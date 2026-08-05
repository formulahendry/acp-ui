<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSessionStore } from '../stores/session';
import type { SavedSession } from '../lib/types';

const emit = defineEmits<{
  resume: [session: SavedSession];
  delete: [sessionId: string];
}>();

const sessionStore = useSessionStore();

// Only show sessions that can be resumed (agent supports loadSession)
const sessions = computed(() => 
  [...sessionStore.resumableSessions].sort((a, b) => b.lastUpdated - a.lastUpdated)
);

const pendingDeleteSessionId = ref<string | null>(null);

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function handleResume(session: SavedSession) {
  if (pendingDeleteSessionId.value) return;
  emit('resume', session);
}

function promptDelete(sessionId: string) {
  pendingDeleteSessionId.value = sessionId;
}

function cancelDelete() {
  pendingDeleteSessionId.value = null;
}

function confirmDelete() {
  if (!pendingDeleteSessionId.value) return;
  emit('delete', pendingDeleteSessionId.value);
  pendingDeleteSessionId.value = null;
}
</script>

<template>
  <div class="session-list">
    <h3>Saved Sessions</h3>
    
    <div v-if="sessions.length === 0" class="empty-state">
      <p>No saved sessions yet.</p>
      <p class="hint">Create a new session to get started.</p>
    </div>
    
    <ul v-else>
      <li 
        v-for="session in sessions" 
        :key="session.id"
        class="session-item"
        @click="handleResume(session)"
      >
        <div class="session-info">
          <span class="session-title">{{ session.title }}</span>
          <span class="session-agent">{{ session.agentName }}</span>
          <span class="session-date">{{ formatDate(session.lastUpdated) }}</span>
        </div>
        <button 
          class="delete-btn"
          type="button"
          @click.stop="promptDelete(session.id)"
          title="Delete session"
        >
          ×
        </button>
      </li>
    </ul>

    <div
      v-if="pendingDeleteSessionId"
      class="delete-overlay"
      @click.self="cancelDelete"
    >
      <div class="delete-dialog">
        <h4>Delete this session?</h4>
        <p>This only removes it from the saved session list.</p>
        <div class="delete-actions">
          <button type="button" class="cancel-btn" @click="cancelDelete">
            Cancel
          </button>
          <button type="button" class="confirm-btn" @click="confirmDelete">
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-list {
  padding: 1rem;
}

h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: var(--text-secondary, #666);
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted, #999);
}

.empty-state .hint {
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: background 0.15s;
}

.session-item:hover {
  background: var(--bg-hover, #f5f5f5);
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow: hidden;
}

.session-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-agent {
  font-size: 0.75rem;
  color: var(--text-accent, #0066cc);
}

.session-date {
  font-size: 0.75rem;
  color: var(--text-muted, #999);
}

.delete-btn {
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-muted, #999);
  font-size: 1.25rem;
  cursor: pointer;
  border-radius: 4px;
}

.delete-btn:hover {
  background: var(--bg-danger, #fee);
  color: var(--text-danger, #c00);
}

.delete-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.delete-dialog {
  width: min(360px, calc(100vw - 2rem));
  background: var(--bg-main, #fff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  padding: 1rem;
}

.delete-dialog h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: var(--text-primary, #222);
}

.delete-dialog p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary, #666);
}

.delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}

.cancel-btn,
.confirm-btn {
  border-radius: 6px;
  padding: 0.5rem 0.9rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.cancel-btn {
  border: 1px solid var(--border-color, #ccc);
  background: var(--bg-button, #fff);
  color: var(--text-secondary, #555);
}

.cancel-btn:hover {
  background: var(--bg-hover, #f5f5f5);
}

.confirm-btn {
  border: 1px solid transparent;
  background: var(--bg-danger, #d94b4b);
  color: #fff;
}

.confirm-btn:hover {
  filter: brightness(0.95);
}
</style>
