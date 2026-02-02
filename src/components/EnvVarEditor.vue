<script setup lang="ts">
import { ref, watch, computed } from 'vue';

interface EnvVar {
  key: string;
  value: string;
}

const props = defineProps<{
  modelValue: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, string>): void;
}>();

const envVars = ref<EnvVar[]>([]);

// Convert Record to array for editing
watch(
  () => props.modelValue,
  (newValue) => {
    envVars.value = Object.entries(newValue || {}).map(([key, value]) => ({
      key,
      value,
    }));
  },
  { immediate: true }
);

// Emit changes when envVars change
function emitUpdate() {
  const result: Record<string, string> = {};
  for (const env of envVars.value) {
    if (env.key.trim()) {
      result[env.key.trim()] = env.value;
    }
  }
  emit('update:modelValue', result);
}

function addEnvVar() {
  envVars.value.push({ key: '', value: '' });
}

function removeEnvVar(index: number) {
  envVars.value.splice(index, 1);
  emitUpdate();
}

function onKeyChange(index: number, event: Event) {
  const input = event.target as HTMLInputElement;
  envVars.value[index].key = input.value;
  emitUpdate();
}

function onValueChange(index: number, event: Event) {
  const input = event.target as HTMLInputElement;
  envVars.value[index].value = input.value;
  emitUpdate();
}

const hasEnvVars = computed(() => envVars.value.length > 0);
</script>

<template>
  <div class="env-var-editor">
    <div class="env-header">
      <span class="env-label">Environment Variables</span>
      <button type="button" class="add-env-btn" @click="addEnvVar">
        + Add
      </button>
    </div>

    <div v-if="hasEnvVars" class="env-list">
      <div v-for="(env, index) in envVars" :key="index" class="env-row">
        <input
          type="text"
          class="env-key"
          placeholder="KEY"
          :value="env.key"
          @input="onKeyChange(index, $event)"
        />
        <span class="env-equals">=</span>
        <input
          type="text"
          class="env-value"
          placeholder="value"
          :value="env.value"
          @input="onValueChange(index, $event)"
        />
        <button
          type="button"
          class="remove-env-btn"
          @click="removeEnvVar(index)"
          title="Remove"
        >
          ✕
        </button>
      </div>
    </div>

    <div v-else class="env-empty">
      No environment variables configured.
    </div>
  </div>
</template>

<style scoped>
.env-var-editor {
  margin-top: 0.5rem;
}

.env-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.env-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.add-env-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
}

.add-env-btn:hover {
  background: var(--bg-hover);
}

.env-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.env-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.env-key {
  flex: 0 0 120px;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: monospace;
  font-size: 0.875rem;
}

.env-equals {
  color: var(--text-secondary);
  padding: 0 0.25rem;
}

.env-value {
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: monospace;
  font-size: 0.875rem;
}

.remove-env-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.remove-env-btn:hover {
  color: #e74c3c;
}

.env-empty {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-style: italic;
}

.env-key:focus,
.env-value:focus {
  outline: none;
  border-color: var(--accent-color);
}
</style>
