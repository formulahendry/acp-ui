<script setup lang="ts">
import type { PermissionRequest } from '../lib/types';

defineProps<{
  request: PermissionRequest;
}>();

const emit = defineEmits<{
  select: [optionId: string];
  cancel: [];
}>();

function handleSelect(optionId: string) {
  emit('select', optionId);
}

function handleCancel() {
  emit('cancel');
}
</script>

<template>
  <div class="permission-overlay">
    <div class="permission-dialog">
      <div class="dialog-header">
        <span class="icon">🔐</span>
        <h3>Permission Required</h3>
      </div>
      
      <div class="dialog-content">
        <div class="tool-info">
          <span class="tool-title">{{ request.toolCall.title }}</span>
          <span class="tool-kind">{{ request.toolCall.kind }}</span>
        </div>
        
        <div v-if="request.toolCall.locations?.length" class="locations">
          <div 
            v-for="(loc, index) in request.toolCall.locations" 
            :key="index"
            class="location"
          >
            📁 {{ loc.path }}
          </div>
        </div>
      </div>
      
      <div class="dialog-actions">
        <button 
          v-for="option in request.options" 
          :key="option.optionId"
          :class="['option-btn', `option-${option.kind}`]"
          @click="handleSelect(option.optionId)"
        >
          {{ option.name }}
        </button>
        <button class="cancel-btn" @click="handleCancel">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.permission-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.permission-dialog {
  background: var(--bg-dialog, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 480px;
  width: 90%;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--bg-header, #f5f5f5);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.dialog-header .icon {
  font-size: 1.5rem;
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.dialog-content {
  padding: 1rem;
}

.tool-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tool-title {
  font-weight: 600;
  font-size: 1rem;
}

.tool-kind {
  font-size: 0.875rem;
  color: var(--text-muted, #666);
  text-transform: capitalize;
}

.locations {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-hover, #f5f5f5);
  border-radius: 4px;
  border: 1px solid var(--border-color, #e0e0e0);
}

.location {
  font-family: monospace;
  font-size: 0.8rem;
  padding: 0.125rem 0;
  color: var(--text-primary, #333);
  word-break: break-all;
}

.dialog-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid var(--border-color, #e0e0e0);
  background: var(--bg-footer, #fafafa);
}

.option-btn {
  flex: 1;
  min-width: 120px;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.option-allow_once,
.option-allow_always {
  background: var(--bg-success, #28a745);
  color: white;
}

.option-allow_once:hover,
.option-allow_always:hover {
  background: var(--bg-success-hover, #218838);
}

.option-reject_once,
.option-reject_always {
  background: var(--bg-danger, #dc3545);
  color: white;
}

.option-reject_once:hover,
.option-reject_always:hover {
  background: var(--bg-danger-hover, #c82333);
}

.cancel-btn {
  flex: 1;
  min-width: 120px;
  padding: 0.625rem 1rem;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 4px;
  background: var(--bg-button, #fff);
  font-size: 0.9rem;
  cursor: pointer;
}

.cancel-btn:hover {
  background: var(--bg-hover, #f0f0f0);
}
</style>
