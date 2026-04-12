import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { AttachmentRef } from '../lib/types';
import type { SessionNotification } from '@agentclientprotocol/sdk';

const mockPrompt = vi.fn();
const mockInitialize = vi.fn();
const mockNewSession = vi.fn();
const mockDisconnect = vi.fn();
const mockLoad = vi.fn();
const mockGetVersion = vi.fn();
const mockSpawnAgent = vi.fn();
const mockOnAgentStderr = vi.fn();
const mockTrackEvent = vi.fn();
const mockTrackError = vi.fn();
let lastClient: {
  pendingPermissionRequest: { value: null };
  onSessionUpdate: ((notification: SessionNotification) => void) | null;
  initialize: typeof mockInitialize;
  newSession: typeof mockNewSession;
  prompt: typeof mockPrompt;
  disconnect: typeof mockDisconnect;
} | null = null;

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
  createAcpClient: vi.fn(async () => {
    lastClient = {
      pendingPermissionRequest: { value: null },
      onSessionUpdate: null,
      initialize: mockInitialize,
      newSession: mockNewSession,
      prompt: mockPrompt,
      disconnect: mockDisconnect,
    };

    return lastClient;
  }),
}));

function makeAttachment(overrides: Partial<AttachmentRef> & Pick<AttachmentRef, 'id' | 'name' | 'path'>): AttachmentRef {
  return {
    id: overrides.id,
    name: overrides.name,
    path: overrides.path,
    mimeType: overrides.mimeType ?? 'application/octet-stream',
    size: overrides.size ?? 1024,
    source: overrides.source ?? 'local',
  };
}

async function createReadyStore() {
  const { useSessionStore } = await import('../stores/session');
  const store = useSessionStore();
  await store.initStore();
  await store.createSession('Test Agent', 'D:/workspace');
  return store;
}

describe('session store sendPrompt', () => {
  beforeEach(() => {
    vi.resetModules();
    setActivePinia(createPinia());

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
    lastClient = null;

    mockLoad.mockResolvedValue({
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    });
    mockGetVersion.mockResolvedValue('1.0.0-test');
    mockSpawnAgent.mockResolvedValue({ id: 'agent-1', name: 'Test Agent' });
    mockOnAgentStderr.mockResolvedValue(() => undefined);
    mockInitialize.mockResolvedValue({ agentCapabilities: {}, authMethods: [] });
    mockNewSession.mockResolvedValue({ sessionId: 'session-1' });
    mockPrompt.mockResolvedValue({ stopReason: 'end_turn' });
  });

  it('sends a text-only prompt and stores no attachments metadata', async () => {
    const store = await createReadyStore();

    await store.sendPrompt('hello');

    expect(mockPrompt).toHaveBeenCalledWith({
      sessionId: 'session-1',
      prompt: [{ type: 'text', text: 'hello' }],
    });
    expect(store.messages).toHaveLength(1);
    expect(store.messages[0]).toMatchObject({
      role: 'user',
      content: 'hello',
    });
    expect(store.messages[0].attachments).toBeUndefined();
  });

  it('sends text plus attachment resource links and stores attachments metadata', async () => {
    const store = await createReadyStore();
    const attachments = [
      makeAttachment({ id: '1', name: 'file1.md', path: '/path1', mimeType: 'text/markdown' }),
      makeAttachment({ id: '2', name: 'file2.json', path: '/path2', mimeType: 'application/json' }),
    ];

    await store.sendPrompt('hello', attachments);

    expect(mockPrompt).toHaveBeenCalledWith({
      sessionId: 'session-1',
      prompt: [
        { type: 'text', text: 'hello' },
        { type: 'resource_link', uri: 'file:///path1', name: 'file1.md', mimeType: 'text/markdown' },
        { type: 'resource_link', uri: 'file:///path2', name: 'file2.json', mimeType: 'application/json' },
      ],
    });
    expect(store.messages).toHaveLength(1);
    expect(store.messages[0].attachments).toEqual(attachments);
  });

  it('treats an empty attachments array like a text-only prompt', async () => {
    const store = await createReadyStore();

    await store.sendPrompt('hello', []);

    expect(mockPrompt).toHaveBeenCalledWith({
      sessionId: 'session-1',
      prompt: [{ type: 'text', text: 'hello' }],
    });
    expect(store.messages).toHaveLength(1);
    expect(store.messages[0].attachments).toBeUndefined();
  });

  it('stores a visible error when the prompt request fails', async () => {
    const store = await createReadyStore();
    mockPrompt.mockRejectedValueOnce(new Error('agent unreachable'));

    await expect(store.sendPrompt('hello')).rejects.toThrow('agent unreachable');
    expect(store.error).toBe('Prompt failed: agent unreachable');
  });

  it('ignores session/prompt timeout when agent activity already streamed', async () => {
    const store = await createReadyStore();

    mockPrompt.mockImplementationOnce(async () => {
      lastClient?.onSessionUpdate?.({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: {
            type: 'text',
            text: 'streamed reply',
          },
        },
      } as SessionNotification);

      throw new Error('Request timeout: session/prompt');
    });

    await expect(store.sendPrompt('hello')).resolves.toBeUndefined();
    expect(store.error).toBeNull();
    expect(store.messages[store.messages.length - 1]).toMatchObject({
      role: 'assistant',
      content: 'streamed reply',
    });
  });
});
