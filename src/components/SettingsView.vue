<script setup lang="ts">
import { ref, computed } from 'vue';
import { useConfigStore } from '../stores/config';
import { addAgent, removeAgent, updateAgent } from '../lib/tauri';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const configStore = useConfigStore();

const agents = computed(() => {
  return Object.entries(configStore.config.agents).map(([name, config]) => ({
    name,
    command: config.command,
    args: config.args.join(' '),
  }));
});

// Form state
const showAddForm = ref(false);
const editingAgent = ref<string | null>(null);
const formName = ref('');
const formCommand = ref('');
const formArgs = ref('');
const formError = ref('');
const isSubmitting = ref(false);

function resetForm() {
  formName.value = '';
  formCommand.value = '';
  formArgs.value = '';
  formError.value = '';
  showAddForm.value = false;
  editingAgent.value = null;
}

function startAdd() {
  resetForm();
  showAddForm.value = true;
}

function startEdit(agent: { name: string; command: string; args: string }) {
  resetForm();
  editingAgent.value = agent.name;
  formName.value = agent.name;
  formCommand.value = agent.command;
  formArgs.value = agent.args;
}

function parseArgs(argsString: string): string[] {
  // Simple arg parsing - split on spaces but respect quotes
  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (const char of argsString) {
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (current.trim()) {
        args.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    args.push(current.trim());
  }
  return args;
}

async function handleSubmit() {
  formError.value = '';
  
  if (!formName.value.trim()) {
    formError.value = 'Name is required';
    return;
  }
  if (!formCommand.value.trim()) {
    formError.value = 'Command is required';
    return;
  }

  const args = parseArgs(formArgs.value);
  isSubmitting.value = true;

  try {
    if (editingAgent.value) {
      const newConfig = await updateAgent(formName.value, formCommand.value, args);
      configStore.updateFromEvent(newConfig);
    } else {
      // Check for duplicates
      if (configStore.config.agents[formName.value]) {
        formError.value = 'An agent with this name already exists';
        isSubmitting.value = false;
        return;
      }
      const newConfig = await addAgent(formName.value, formCommand.value, args);
      configStore.updateFromEvent(newConfig);
    }
    resetForm();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e);
  } finally {
    isSubmitting.value = false;
  }
}

async function handleDelete(name: string) {
  if (!confirm(`Delete agent "${name}"?`)) return;
  
  try {
    const newConfig = await removeAgent(name);
    configStore.updateFromEvent(newConfig);
  } catch (e) {
    console.error('Failed to delete agent:', e);
  }
}
</script>

<template>
  <div class="settings-overlay" @click.self="emit('close')">
    <div class="settings-panel">
      <div class="settings-header">
        <h2>Settings</h2>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="settings-content">
        <section class="agents-section">
          <div class="section-header">
            <h3>Agents</h3>
            <button class="add-btn" @click="startAdd" :disabled="showAddForm">
              + Add Agent
            </button>
          </div>

          <!-- Add/Edit Form -->
          <div v-if="showAddForm || editingAgent" class="agent-form">
            <h4>{{ editingAgent ? 'Edit Agent' : 'Add New Agent' }}</h4>
            
            <div class="form-group">
              <label>Name</label>
              <input 
                v-model="formName" 
                type="text" 
                placeholder="My Agent"
                :disabled="!!editingAgent"
              />
            </div>

            <div class="form-group">
              <label>Command</label>
              <input 
                v-model="formCommand" 
                type="text" 
                placeholder="npx"
              />
            </div>

            <div class="form-group">
              <label>Arguments</label>
              <input 
                v-model="formArgs" 
                type="text" 
                placeholder="-y @example/agent"
              />
              <small>Space-separated. Use quotes for args with spaces.</small>
            </div>

            <div v-if="formError" class="form-error">
              {{ formError }}
            </div>

            <div class="form-actions">
              <button 
                class="save-btn" 
                @click="handleSubmit"
                :disabled="isSubmitting"
              >
                {{ isSubmitting ? 'Saving...' : 'Save' }}
              </button>
              <button class="cancel-btn" @click="resetForm">
                Cancel
              </button>
            </div>
          </div>

          <!-- Agent List -->
          <div class="agents-list">
            <div 
              v-for="agent in agents" 
              :key="agent.name"
              class="agent-item"
            >
              <div class="agent-info">
                <div class="agent-name">{{ agent.name }}</div>
                <div class="agent-command">
                  <code>{{ agent.command }} {{ agent.args }}</code>
                </div>
              </div>
              <div class="agent-actions">
                <button class="edit-btn" @click="startEdit(agent)">
                  Edit
                </button>
                <button class="delete-btn" @click="handleDelete(agent.name)">
                  Delete
                </button>
              </div>
            </div>

            <div v-if="agents.length === 0" class="no-agents">
              No agents configured. Add one to get started!
            </div>
          </div>
        </section>

        <section class="config-section">
          <h3>Config File</h3>
          <p class="config-path">{{ configStore.configPath }}</p>
          <small>Changes to this file are automatically reloaded.</small>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.settings-panel {
  background: var(--bg-main);
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.settings-header h2 {
  margin: 0;
  font-size: 1.25rem;
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

.settings-content {
  padding: 1.25rem;
  overflow-y: auto;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.section-header h3 {
  margin: 0;
}

.add-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--bg-primary);
  background: transparent;
  color: var(--bg-primary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.add-btn:hover:not(:disabled) {
  background: var(--bg-primary);
  color: white;
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.agent-form {
  background: var(--bg-sidebar);
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.agent-form h4 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 0.9rem;
  background: var(--bg-main);
  color: var(--text-primary);
}

.form-group input:focus {
  outline: none;
  border-color: var(--bg-primary);
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.form-error {
  color: var(--bg-danger);
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
}

.save-btn {
  padding: 0.5rem 1rem;
  background: var(--bg-primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn:hover:not(:disabled) {
  background: var(--bg-primary-hover);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn:hover {
  background: var(--bg-hover);
}

.agents-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.agent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: var(--bg-sidebar);
  border-radius: 6px;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.agent-command {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.agent-command code {
  background: var(--bg-main);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  word-break: break-all;
}

.agent-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: 1rem;
}

.edit-btn,
.delete-btn {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}

.edit-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.edit-btn:hover {
  background: var(--bg-hover);
}

.delete-btn {
  background: transparent;
  border: 1px solid var(--bg-danger);
  color: var(--bg-danger);
}

.delete-btn:hover {
  background: var(--bg-danger);
  color: white;
}

.no-agents {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
}

.config-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.config-section h3 {
  margin: 0 0 0.5rem 0;
}

.config-path {
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--text-secondary);
  background: var(--bg-sidebar);
  padding: 0.5rem;
  border-radius: 4px;
  word-break: break-all;
  margin-bottom: 0.25rem;
}

.config-section small {
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>
