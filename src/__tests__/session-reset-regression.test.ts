import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import ChatView from '../components/ChatView.vue';
import { useSessionStore } from '../stores/session';
import { _resetRawPicker, _setRawPicker } from '../lib/file-picker';

const {
  mockPrompt,
  mockInitialize,
  mockNewSession,
  mockDisconnect,
  mockLoad,
  mockGetVersion,
  mockSpawnAgent,
  mockOnAgentStderr,
  mockTrackEvent,
  mockTrackError,
} = vi.hoisted(() => ({
  mockPrompt: vi.fn(),
  mockInitialize: vi.fn(),
  mockNewSession: vi.fn(),
  mockDisconnect: vi.fn(),
  mockLoad: vi.fn(),
  mockGetVersion: vi.fn(),
  mockSpawnAgent: vi.fn(),
  mockOnAgentStderr: vi.fn(),
  mockTrackEvent: vi.fn(),
  mockTrackError: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
  message: vi.fn(),
  ask: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  stat: vi.fn(),
  exists: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: vi.fn(),
  load: mockLoad,
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: mockGetVersion,
}));

vi.mock('../lib/telemetry', () => ({
  trackEvent: mockTrackEvent,
  trackError: mockTrackError,
}));

vi.mock('../lib/tauri', () => ({
  spawnAgent: mockSpawnAgent,
  killAgent: vi.fn(),
  onAgentStderr: mockOnAgentStderr,
}));

vi.mock('../lib/acp-bridge', () => ({
  AcpClientBridge: class {},
  createAcpClient: vi.fn(async () => ({
    pendingPermissionRequest: { value: null },
    onSessionUpdate: null,
    initialize: mockInitialize,
    newSession: mockNewSession,
    prompt: mockPrompt,
    disconnect: mockDisconnect,
  })),
}));

function makeAttachmentSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    agentName: 'Test Agent',
    sessionId: 'session-1',
    title: 'Session 1',
    lastUpdated: Date.now(),
    cwd: 'D:/workspace',
    supportsLoadSession: true,
    ...overrides,
  };
}

async function createReadyStore() {
  const store = useSessionStore();
  await store.initStore();
  await store.createSession('Test Agent', 'D:/workspace');
  return store;
}

async function mountChatViewWithSession() {
  const store = await createReadyStore();
  const wrapper = mount(ChatView, {
    global: {
      stubs: {
        ModePicker: true,
        ModelPicker: true,
        CommandPalette: true,
      },
    },
  });

  await nextTick();
  return { store, wrapper };
}

describe('session reset regressions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    _resetRawPicker();

    mockPrompt.mockReset();
    mockInitialize.mockReset();
    mockNewSession.mockReset();
    mockDisconnect.mockReset();
    mockLoad.mockReset();
    mockGetVersion.mockReset();
    mockSpawnAgent.mockReset();
    mockOnAgentStderr.mockReset();
    mockTrackEvent.mockReset();
    mockTrackError.mockReset();

    mockLoad.mockResolvedValue({
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    });
    mockGetVersion.mockResolvedValue('1.0.0-test');
    mockSpawnAgent.mockResolvedValue({ id: 'agent-1', name: 'Test Agent' });
    mockOnAgentStderr.mockResolvedValue(() => undefined);
    mockInitialize.mockResolvedValue({ agentCapabilities: { loadSession: true }, authMethods: [] });
    mockNewSession.mockResolvedValue({ sessionId: 'session-1' });
    mockPrompt.mockResolvedValue({ stopReason: 'end_turn' });
  });

  it('composer attachment lifecycle on send clears pending state but keeps message metadata', async () => {
    const { store, wrapper } = await mountChatViewWithSession();

    await wrapper.find('textarea').setValue('Hello with files');
    _setRawPicker(async () => ['/path/to/file1.txt']);

    await wrapper.find('.attach-btn').trigger('click');
    await flushPromises();

    const chipsBeforeSend = wrapper.findAll('.attachment-chip');
    expect(chipsBeforeSend).toHaveLength(1);
    expect(chipsBeforeSend[0].text()).toContain('file1.txt');

    await wrapper.find('.send-btn').trigger('click');
    await flushPromises();
    await nextTick();

    expect(wrapper.findAll('.attachment-chip')).toHaveLength(0);
    expect(store.messages).toHaveLength(1);
    expect(store.messages[0].attachments).toHaveLength(1);
    expect(store.messages[0].attachments?.[0]).toMatchObject({
      name: 'file1.txt',
      path: '/path/to/file1.txt',
      mimeType: 'text/plain',
      source: 'local',
    });
  });

  it('session switch clears pending attachments', async () => {
    const { store, wrapper } = await mountChatViewWithSession();

    _setRawPicker(async () => ['/path/to/file1.txt']);
    await wrapper.find('.attach-btn').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.attachment-chip')).toHaveLength(1);

    store.currentSession = makeAttachmentSession({
      id: 'session-2',
      sessionId: 'session-2',
      title: 'Session 2',
    });

    await flushPromises();
    await nextTick();

    expect(wrapper.findAll('.attachment-chip')).toHaveLength(0);
    expect(wrapper.find('.attachment-rejections').exists()).toBe(false);
  });

  it('canceling picker is a no-op', async () => {
    const { wrapper } = await mountChatViewWithSession();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    _setRawPicker(async () => null);
    await wrapper.find('.attach-btn').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.attachment-chip')).toHaveLength(0);
    expect(wrapper.find('.attachment-rejections').exists()).toBe(false);
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
