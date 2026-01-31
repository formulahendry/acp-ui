// Traffic store for ACP message monitoring
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type TrafficDirection = 'in' | 'out';
export type TrafficType = 'request' | 'response' | 'notification';

export interface TrafficEntry {
  id: string;
  timestamp: number;
  direction: TrafficDirection;
  type: TrafficType;
  method: string;
  requestId?: number | string;
  payload: unknown;
  error?: boolean;
}

const MAX_ENTRIES = 500;

export const useTrafficStore = defineStore('traffic', () => {
  const entries = ref<TrafficEntry[]>([]);
  const isPaused = ref(false);
  const filter = ref<'all' | 'requests' | 'responses' | 'notifications'>('all');
  const searchQuery = ref('');

  const filteredEntries = computed(() => {
    let result = entries.value;
    
    // Apply type filter
    switch (filter.value) {
      case 'requests':
        result = result.filter(e => e.type === 'request');
        break;
      case 'responses':
        result = result.filter(e => e.type === 'response');
        break;
      case 'notifications':
        result = result.filter(e => e.type === 'notification');
        break;
    }
    
    // Apply search filter
    const query = searchQuery.value.trim().toLowerCase();
    if (query) {
      result = result.filter(e => 
        e.method.toLowerCase().includes(query) ||
        JSON.stringify(e.payload).toLowerCase().includes(query)
      );
    }
    
    return result;
  });

  function addEntry(entry: Omit<TrafficEntry, 'id' | 'timestamp'>) {
    if (isPaused.value) return;
    
    const newEntry: TrafficEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    
    entries.value.push(newEntry);
    
    // Limit entries to prevent memory issues
    if (entries.value.length > MAX_ENTRIES) {
      entries.value = entries.value.slice(-MAX_ENTRIES);
    }
  }

  function clear() {
    entries.value = [];
  }

  function togglePause() {
    isPaused.value = !isPaused.value;
  }

  function setFilter(newFilter: typeof filter.value) {
    filter.value = newFilter;
  }

  function setSearch(query: string) {
    searchQuery.value = query;
  }

  function clearSearch() {
    searchQuery.value = '';
  }

  return {
    entries,
    filteredEntries,
    isPaused,
    filter,
    searchQuery,
    addEntry,
    clear,
    togglePause,
    setFilter,
    setSearch,
    clearSearch,
  };
});
