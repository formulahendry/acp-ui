<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ModelInfo } from '../lib/types';

const props = defineProps<{
  models: ModelInfo[];
  currentModelId: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  change: [modelId: string];
}>();

const isOpen = ref(false);

const currentModel = computed(() => 
  props.models.find(m => m.modelId === props.currentModelId)
);

function getModelIcon(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes('claude')) return '🟣';
  if (lower.includes('gpt') || lower.includes('openai')) return '🟢';
  if (lower.includes('gemini') || lower.includes('google')) return '🔵';
  if (lower.includes('llama') || lower.includes('meta')) return '🟠';
  if (lower.includes('mistral')) return '🔴';
  if (lower.includes('deepseek')) return '🟤';
  return '🤖';
}

function toggleDropdown() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value;
  }
}

function selectModel(modelId: string) {
  if (modelId !== props.currentModelId) {
    emit('change', modelId);
  }
  isOpen.value = false;
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.model-picker')) {
    isOpen.value = false;
  }
}

// Close dropdown when clicking outside
if (typeof window !== 'undefined') {
  window.addEventListener('click', handleClickOutside);
}
</script>

<template>
  <div class="model-picker" :class="{ disabled }">
    <button 
      class="model-button"
      :disabled="disabled"
      @click.stop="toggleDropdown"
      :title="currentModel?.name || currentModelId"
    >
      <span class="model-icon">{{ getModelIcon(currentModelId) }}</span>
      <span class="model-name">{{ currentModel?.name || currentModelId }}</span>
      <span class="dropdown-arrow">{{ isOpen ? '▲' : '▼' }}</span>
    </button>
    
    <Transition name="dropdown">
      <div v-if="isOpen" class="dropdown-menu" @click.stop>
        <div 
          v-for="model in models"
          :key="model.modelId"
          :class="['dropdown-item', { selected: model.modelId === currentModelId }]"
          @click="selectModel(model.modelId)"
        >
          <span class="item-icon">{{ getModelIcon(model.modelId) }}</span>
          <div class="item-content">
            <span class="item-name">{{ model.name }}</span>
            <span v-if="model.description" class="item-description">
              {{ model.description }}
            </span>
          </div>
          <span v-if="model.modelId === currentModelId" class="check-mark">✓</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.model-picker {
  position: relative;
  display: inline-block;
}

.model-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.model-button {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-main);
  color: var(--text-primary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s ease;
  max-width: 200px;
}

.model-button:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--text-accent);
}

.model-button:disabled {
  cursor: not-allowed;
}

.model-icon {
  font-size: 0.9rem;
  flex-shrink: 0;
}

.model-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-arrow {
  font-size: 0.6rem;
  color: var(--text-muted);
  margin-left: 0.25rem;
  flex-shrink: 0;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 280px;
  max-width: 360px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

@media (prefers-color-scheme: dark) {
  .dropdown-menu {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
}

.dropdown-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  cursor: pointer;
  transition: background 0.1s ease;
}

.dropdown-item:hover {
  background: var(--bg-hover);
}

.dropdown-item.selected {
  background: var(--bg-user);
}

.dropdown-item + .dropdown-item {
  border-top: 1px solid var(--border-color);
}

.item-icon {
  font-size: 1rem;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-name {
  display: block;
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.85rem;
}

.item-description {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.125rem;
  line-height: 1.3;
}

.check-mark {
  color: var(--text-accent);
  font-weight: bold;
  margin-left: auto;
  flex-shrink: 0;
}

/* Dropdown animation */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
