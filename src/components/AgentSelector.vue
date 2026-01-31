<script setup lang="ts">
import { computed, watch } from 'vue';
import { useConfigStore } from '../stores/config';

const emit = defineEmits<{
  select: [agentName: string];
}>();

const configStore = useConfigStore();

const selectedAgent = defineModel<string>('selected', { default: '' });

const agents = computed(() => configStore.agentNames);
const hasAgents = computed(() => configStore.hasAgents);
const configPath = computed(() => configStore.configPath);

// Auto-select first agent when agents are available and none selected
watch(agents, (newAgents) => {
  if (newAgents.length > 0 && !selectedAgent.value) {
    selectedAgent.value = newAgents[0];
    emit('select', newAgents[0]);
  }
}, { immediate: true });

function handleSelect(event: Event) {
  const target = event.target as HTMLSelectElement;
  selectedAgent.value = target.value;
  if (target.value) {
    emit('select', target.value);
  }
}
</script>

<template>
  <div class="agent-selector">
    <label for="agent-select">Agent:</label>
    <select 
      id="agent-select" 
      :value="selectedAgent"
      @change="handleSelect"
      :disabled="!hasAgents"
    >
      <option value="" disabled>
        {{ hasAgents ? 'Select an agent...' : 'No agents configured' }}
      </option>
      <option v-for="agent in agents" :key="agent" :value="agent">
        {{ agent }}
      </option>
    </select>
    
    <div v-if="!hasAgents" class="config-hint">
      <p>No agents found. Add agents to:</p>
      <code>{{ configPath }}</code>
    </div>
  </div>
</template>

<style scoped>
.agent-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 600;
  color: var(--text-secondary, #666);
}

select {
  padding: 0.5rem;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 4px;
  font-size: 1rem;
  background: var(--bg-input, #fff);
  color: var(--text-primary, #333);
}

select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.config-hint {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: var(--bg-warning, #fff3cd);
  border-radius: 4px;
  font-size: 0.875rem;
}

.config-hint code {
  display: block;
  margin-top: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: var(--bg-code, #f5f5f5);
  border-radius: 2px;
  font-family: monospace;
  word-break: break-all;
}
</style>
