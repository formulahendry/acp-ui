<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { SlashCommand } from '../lib/types';

const props = defineProps<{
  commands: SlashCommand[];
  filter: string;
  visible: boolean;
}>();

const emit = defineEmits<{
  select: [command: SlashCommand];
  close: [];
}>();

const selectedIndex = ref(0);

// Filter commands based on input
const filteredCommands = computed(() => {
  const filterText = props.filter.toLowerCase();
  if (!filterText) return props.commands;
  return props.commands.filter(cmd => 
    cmd.name.toLowerCase().startsWith(filterText) ||
    cmd.description.toLowerCase().includes(filterText)
  );
});

// Reset selection when filter or visibility changes
watch([() => props.filter, () => props.visible], () => {
  selectedIndex.value = 0;
});

function handleKeyDown(event: KeyboardEvent) {
  if (!props.visible || filteredCommands.value.length === 0) return;
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      selectedIndex.value = (selectedIndex.value + 1) % filteredCommands.value.length;
      break;
    case 'ArrowUp':
      event.preventDefault();
      selectedIndex.value = (selectedIndex.value - 1 + filteredCommands.value.length) % filteredCommands.value.length;
      break;
    case 'Enter':
      event.preventDefault();
      if (filteredCommands.value[selectedIndex.value]) {
        emit('select', filteredCommands.value[selectedIndex.value]);
      }
      break;
    case 'Escape':
      event.preventDefault();
      emit('close');
      break;
    case 'Tab':
      event.preventDefault();
      if (filteredCommands.value[selectedIndex.value]) {
        emit('select', filteredCommands.value[selectedIndex.value]);
      }
      break;
  }
}

// Expose keyboard handler for parent to call
defineExpose({ handleKeyDown });

function selectCommand(cmd: SlashCommand) {
  emit('select', cmd);
}
</script>

<template>
  <div 
    v-if="visible && filteredCommands.length > 0"
    ref="paletteRef"
    class="command-palette"
  >
    <div class="command-list">
      <div 
        v-for="(cmd, index) in filteredCommands"
        :key="cmd.name"
        :class="['command-item', { selected: index === selectedIndex }]"
        @click="selectCommand(cmd)"
        @mouseenter="selectedIndex = index"
      >
        <div class="command-row">
          <span class="command-name">/{{ cmd.name }}</span>
          <span class="command-description">{{ cmd.description }}</span>
        </div>
      </div>
    </div>
    <!-- Tooltip on right side for selected item -->
    <div 
      v-if="filteredCommands[selectedIndex]?.description"
      class="command-tooltip"
    >
      {{ filteredCommands[selectedIndex].description }}
    </div>
  </div>
</template>

<style scoped>
/* Light theme VS Code style */
.command-palette {
  position: absolute;
  bottom: 100%;
  left: 0;
  width: 400px;
  margin-bottom: 6px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.10);
  max-height: 320px;
  overflow: visible;
  z-index: 100;
}

.command-list {
  max-height: 320px;
  overflow-y: auto;
}

.command-item {
  padding: 8px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
  display: flex;
  align-items: center;
  transition: background 0.12s;
  position: relative;
}
.command-item:last-child {
  border-bottom: none;
}
.command-item.selected {
  background: #2563eb;
  color: #fff;
  border-radius: 6px;
}
.command-item.selected .command-name,
.command-item.selected .command-hint,
.command-item.selected .command-description,
.command-item.selected .command-source {
  color: #fff;
}

.command-tooltip {
  position: absolute;
  left: calc(100% + 8px);
  top: 0;
  width: 220px;
  background: #fff;
  color: #333;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  padding: 8px 12px;
  font-size: 0.95em;
  white-space: normal;
  z-index: 200;
  word-break: break-word;
}
.command-item:hover:not(.selected) {
  background: #f3f8fd;
}

/* Command row: command and description on same line */
.command-row {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 0;
}
.command-name {
  font-weight: 600;
  color: #2563eb;
  font-family: monospace;
  font-size: 1em;
  min-width: 110px;
  max-width: 140px;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.command-description {
  color: #666;
  font-size: 0.97em;
  margin-left: 18px;
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.command-item.selected .command-name,
.command-item.selected .command-description {
  color: #fff;
}
</style>
