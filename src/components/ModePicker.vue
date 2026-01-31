<script setup lang="ts">
import { ref, computed } from 'vue';
import type { SessionMode } from '../lib/types';

const props = defineProps<{
  modes: SessionMode[];
  currentModeId: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  change: [modeId: string];
}>();

const isOpen = ref(false);

const currentMode = computed(() => 
  props.modes.find(m => m.id === props.currentModeId)
);

function getModeIcon(modeId: string): string {
  switch (modeId.toLowerCase()) {
    case 'ask': return '🎯';
    case 'architect': 
    case 'plan': return '📐';
    case 'code': 
    case 'auto': return '💻';
    case 'debug': return '🐛';
    case 'review': return '👀';
    default: return '⚙️';
  }
}

function toggleDropdown() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value;
  }
}

function selectMode(modeId: string) {
  if (modeId !== props.currentModeId) {
    emit('change', modeId);
  }
  isOpen.value = false;
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.mode-picker')) {
    isOpen.value = false;
  }
}

// Close dropdown when clicking outside
if (typeof window !== 'undefined') {
  window.addEventListener('click', handleClickOutside);
}
</script>

<template>
  <div class="mode-picker" :class="{ disabled }">
    <button 
      class="mode-button"
      :disabled="disabled"
      @click.stop="toggleDropdown"
    >
      <span class="mode-icon">{{ getModeIcon(currentModeId) }}</span>
      <span class="mode-name">{{ currentMode?.name || currentModeId }}</span>
      <span class="dropdown-arrow">{{ isOpen ? '▲' : '▼' }}</span>
    </button>
    
    <Transition name="dropdown">
      <div v-if="isOpen" class="dropdown-menu" @click.stop>
        <div 
          v-for="mode in modes"
          :key="mode.id"
          :class="['dropdown-item', { selected: mode.id === currentModeId }]"
          @click="selectMode(mode.id)"
        >
          <span class="item-icon">{{ getModeIcon(mode.id) }}</span>
          <div class="item-content">
            <span class="item-name">{{ mode.name }}</span>
            <span v-if="mode.description" class="item-description">
              {{ mode.description }}
            </span>
          </div>
          <span v-if="mode.id === currentModeId" class="check-mark">✓</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.mode-picker {
  position: relative;
  display: inline-block;
}

.mode-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.mode-button {
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
}

.mode-button:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--text-accent);
}

.mode-button:disabled {
  cursor: not-allowed;
}

.mode-icon {
  font-size: 0.9rem;
}

.mode-name {
  font-weight: 500;
}

.dropdown-arrow {
  font-size: 0.6rem;
  color: var(--text-muted);
  margin-left: 0.25rem;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 240px;
  background: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
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
