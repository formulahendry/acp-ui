<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue';
import { useTrafficStore, type TrafficEntry } from '../stores/traffic';

const emit = defineEmits<{
  close: [];
  resize: [height: number];
}>();

const trafficStore = useTrafficStore();
const expandedIds = ref<Set<string>>(new Set());
const logContainer = ref<HTMLElement | null>(null);
const autoScroll = ref(true);

// Resize handling
const isResizing = ref(false);
const panelHeight = ref(220);
const MIN_HEIGHT = 100;
const MAX_HEIGHT = window.innerHeight * 0.7;

function startResize(e: MouseEvent) {
  isResizing.value = true;
  e.preventDefault();
  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
  document.body.style.cursor = 'ns-resize';
  document.body.style.userSelect = 'none';
}

function doResize(e: MouseEvent) {
  if (!isResizing.value) return;
  const newHeight = window.innerHeight - e.clientY;
  panelHeight.value = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, newHeight));
  emit('resize', panelHeight.value);
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', stopResize);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

onUnmounted(() => {
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', stopResize);
});

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
  }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
}

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id);
  } else {
    expandedIds.value.add(id);
  }
  // Force reactivity
  expandedIds.value = new Set(expandedIds.value);
}

function formatJson(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function getEntryClass(entry: TrafficEntry): string {
  const classes = ['entry', entry.direction];
  if (entry.error) classes.push('error');
  return classes.join(' ');
}

function getDirectionIcon(entry: TrafficEntry): string {
  return entry.direction === 'out' ? '→' : '←';
}

function getTypeLabel(entry: TrafficEntry): string {
  if (entry.type === 'notification') {
    return '(notification)';
  } else if (entry.type === 'response') {
    return '(response)';
  }
  return '';
}

// Auto-scroll when new entries arrive
watch(() => trafficStore.entries.length, async () => {
  if (autoScroll.value && logContainer.value && !trafficStore.isPaused) {
    await nextTick();
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
});

function handleScroll() {
  if (!logContainer.value) return;
  const { scrollTop, scrollHeight, clientHeight } = logContainer.value;
  // Disable auto-scroll if user scrolled up
  autoScroll.value = scrollTop + clientHeight >= scrollHeight - 50;
}

function handleCopy(entry: TrafficEntry) {
  navigator.clipboard.writeText(formatJson(entry.payload));
}
</script>

<template>
  <div class="traffic-monitor" :style="{ height: panelHeight + 'px' }">
    <!-- Resize Handle -->
    <div 
      class="resize-handle" 
      @mousedown="startResize"
      title="Drag to resize"
    ></div>
    
    <div class="monitor-header">
      <span class="title">📡 ACP Traffic</span>
      
      <div class="controls">
        <button 
          class="control-btn"
          :class="{ active: trafficStore.isPaused }"
          @click="trafficStore.togglePause()"
          :title="trafficStore.isPaused ? 'Resume' : 'Pause'"
        >
          {{ trafficStore.isPaused ? '▶' : '⏸' }}
        </button>
        
        <button 
          class="control-btn"
          @click="trafficStore.clear()"
          title="Clear"
        >
          🗑
        </button>
        
        <div class="search-container">
          <span class="search-icon">🔍</span>
          <input 
            type="text"
            class="search-input"
            placeholder="Search..."
            :value="trafficStore.searchQuery"
            @input="trafficStore.setSearch(($event.target as HTMLInputElement).value)"
          />
          <button 
            v-if="trafficStore.searchQuery"
            class="search-clear-btn"
            @click="trafficStore.clearSearch()"
            title="Clear search"
          >
            ×
          </button>
        </div>
        
        <span v-if="trafficStore.searchQuery" class="match-count">
          {{ trafficStore.filteredEntries.length }} match{{ trafficStore.filteredEntries.length === 1 ? '' : 'es' }}
        </span>
        
        <select 
          class="filter-select"
          :value="trafficStore.filter"
          @change="trafficStore.setFilter(($event.target as HTMLSelectElement).value as any)"
        >
          <option value="all">All</option>
          <option value="requests">Requests</option>
          <option value="responses">Responses</option>
          <option value="notifications">Notifications</option>
        </select>
      </div>
      
      <button class="close-btn" @click="emit('close')" title="Close">×</button>
    </div>
    
    <div 
      class="log-container" 
      ref="logContainer"
      @scroll="handleScroll"
    >
      <div v-if="trafficStore.filteredEntries.length === 0" class="empty-state">
        No traffic captured yet. Connect to an agent to see ACP messages.
      </div>
      
      <div 
        v-for="entry in trafficStore.filteredEntries" 
        :key="entry.id"
        :class="getEntryClass(entry)"
      >
        <div class="entry-header" @click="toggleExpand(entry.id)">
          <span class="expand-icon">{{ expandedIds.has(entry.id) ? '▾' : '▸' }}</span>
          <span class="timestamp">{{ formatTime(entry.timestamp) }}</span>
          <span class="direction-icon">{{ getDirectionIcon(entry) }}</span>
          <span class="method">{{ entry.method }}</span>
          <span class="type-label">{{ getTypeLabel(entry) }}</span>
          <span v-if="entry.requestId !== undefined" class="request-id">#{{ entry.requestId }}</span>
          <button 
            class="copy-btn" 
            @click.stop="handleCopy(entry)"
            title="Copy JSON"
          >
            📋
          </button>
        </div>
        
        <div v-if="expandedIds.has(entry.id)" class="entry-payload">
          <pre>{{ formatJson(entry.payload) }}</pre>
        </div>
      </div>
    </div>
    
    <div v-if="trafficStore.isPaused" class="paused-indicator">
      ⏸ Paused
    </div>
  </div>
</template>

<style scoped>
.traffic-monitor {
  display: flex;
  flex-direction: column;
  background: var(--bg-sidebar);
  border-top: 1px solid var(--border-color);
  font-size: 0.8rem;
  position: relative;
}

.resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
  background: transparent;
  z-index: 10;
}

.resize-handle:hover,
.resize-handle:active {
  background: var(--bg-primary);
  opacity: 0.5;
}

.monitor-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-main);
  border-bottom: 1px solid var(--border-color);
}

.title {
  font-weight: 600;
  margin-right: auto;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.control-btn {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 0.75rem;
}

.control-btn:hover {
  background: var(--bg-hover);
}

.control-btn.active {
  background: var(--bg-warning);
}

.search-container {
  display: flex;
  align-items: center;
  position: relative;
  background: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0 0.25rem;
}

.search-icon {
  font-size: 0.7rem;
  opacity: 0.6;
}

.search-input {
  width: 120px;
  padding: 0.25rem 0.4rem;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.75rem;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-clear-btn {
  padding: 0 0.25rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
}

.search-clear-btn:hover {
  color: var(--text-primary);
}

.match-count {
  font-size: 0.7rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.filter-select {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-main);
  color: var(--text-primary);
  font-size: 0.75rem;
  cursor: pointer;
}

.close-btn {
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1rem;
  color: var(--text-muted);
}

.close-btn:hover {
  color: var(--text-primary);
}

.log-container {
  flex: 1;
  overflow-y: auto;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
}

.entry {
  border-bottom: 1px solid var(--border-color);
}

.entry-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  cursor: pointer;
}

.entry-header:hover {
  background: var(--bg-hover);
}

.expand-icon {
  color: var(--text-muted);
  width: 1em;
}

.timestamp {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.direction-icon {
  font-weight: bold;
  width: 1em;
}

.entry.out .direction-icon {
  color: #0066cc;
}

.entry.in .direction-icon {
  color: #28a745;
}

.entry.error .direction-icon,
.entry.error .method {
  color: #dc3545;
}

@media (prefers-color-scheme: dark) {
  .entry.out .direction-icon {
    color: #4da6ff;
  }
  
  .entry.in .direction-icon {
    color: #5cb85c;
  }
  
  .entry.error .direction-icon,
  .entry.error .method {
    color: #ff6b6b;
  }
}

.method {
  font-weight: 600;
  color: var(--text-primary);
}

.type-label {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.request-id {
  color: var(--text-accent);
  font-size: 0.7rem;
  margin-left: auto;
}

.copy-btn {
  padding: 0.125rem 0.25rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.7rem;
  opacity: 0;
  transition: opacity 0.15s;
}

.entry-header:hover .copy-btn {
  opacity: 1;
}

.entry-payload {
  padding: 0.5rem 0.75rem 0.75rem 2rem;
  background: var(--bg-code);
  overflow-x: auto;
}

.entry-payload pre {
  margin: 0;
  color: var(--text-code);
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-all;
}

.paused-indicator {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: var(--bg-warning);
  border-radius: 4px;
  font-size: 0.7rem;
  color: #856404;
}
</style>
