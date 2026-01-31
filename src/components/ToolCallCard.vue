<script setup lang="ts">
import { computed } from 'vue';
import type { ToolCallInfo } from '../lib/types';

const props = defineProps<{
  toolCall: ToolCallInfo;
}>();

const statusClass = computed(() => {
  switch (props.toolCall.status) {
    case 'pending': return 'status-pending';
    case 'in_progress': return 'status-running';
    case 'completed': return 'status-completed';
    case 'failed': return 'status-failed';
    default: return '';
  }
});

const statusIcon = computed(() => {
  switch (props.toolCall.status) {
    case 'pending': return '⏳';
    case 'in_progress': return '⚙️';
    case 'completed': return '✅';
    case 'failed': return '❌';
    default: return '🔧';
  }
});

const kindIcon = computed(() => {
  switch (props.toolCall.kind) {
    case 'read': return '📖';
    case 'edit': return '✏️';
    case 'write': return '📝';
    case 'execute': return '▶️';
    default: return '🔧';
  }
});
</script>

<template>
  <div class="tool-call-card" :class="statusClass">
    <div class="tool-header">
      <span class="kind-icon">{{ kindIcon }}</span>
      <span class="tool-title">{{ toolCall.title }}</span>
      <span class="status-icon">{{ statusIcon }}</span>
    </div>
    
    <div v-if="toolCall.locations?.length" class="tool-locations">
      <div 
        v-for="(loc, index) in toolCall.locations" 
        :key="index"
        class="location"
      >
        📁 {{ loc.path }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-call-card {
  padding: 0.75rem;
  border-radius: 6px;
  margin: 0.5rem 0;
  border-left: 3px solid var(--border-color, #ccc);
  background: var(--bg-tool, #f9f9f9);
}

.status-pending {
  border-left-color: #ffc107;
  background: #fffbf0;
}

.status-running {
  border-left-color: #17a2b8;
  background: #f0f9ff;
}

.status-completed {
  border-left-color: #28a745;
  background: #f0fff4;
}

.status-failed {
  border-left-color: #dc3545;
  background: #fff5f5;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.kind-icon {
  font-size: 1rem;
}

.tool-title {
  flex: 1;
  font-weight: 500;
  font-size: 0.9rem;
}

.status-icon {
  font-size: 0.875rem;
}

.tool-locations {
  margin-top: 0.5rem;
  padding-left: 1.5rem;
}

.location {
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--text-muted, #666);
  padding: 0.125rem 0;
}
</style>
