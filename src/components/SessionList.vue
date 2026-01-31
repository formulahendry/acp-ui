<script setup lang="ts">
import { computed } from 'vue';
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

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function handleResume(session: SavedSession) {
  emit('resume', session);
}

function handleDelete(sessionId: string, event: Event) {
  event.stopPropagation();
  if (confirm('Delete this session?')) {
    emit('delete', sessionId);
  }
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
          @click="(e) => handleDelete(session.id, e)"
          title="Delete session"
        >
          ×
        </button>
      </li>
    </ul>
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
</style>
