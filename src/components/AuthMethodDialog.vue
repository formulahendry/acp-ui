<script setup lang="ts">
import type { AuthMethod } from '@agentclientprotocol/sdk';

defineProps<{
  authMethods: AuthMethod[];
  agentName: string;
}>();

const emit = defineEmits<{
  (e: 'select', methodId: string): void;
  (e: 'cancel'): void;
}>();

function handleSelect(methodId: string) {
  emit('select', methodId);
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
            @click="handleSelect(method.id)"
          >
            <div class="method-info">
              <span class="method-name">{{ method.name }}</span>
              <span v-if="method.description" class="method-desc">
                {{ method.description }}
              </span>
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
