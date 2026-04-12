import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { AttachmentRef } from '../lib/types';

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

describe('message attachment persistence', () => {
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

  it('retains attachment metadata on sent user messages after composer reset', async () => {
    const store = await createReadyStore();
    const attachments = [
      makeAttachment({ id: '1', name: 'file1.md', path: '/path1', mimeType: 'text/markdown', size: 12, source: 'local' }),
      makeAttachment({ id: '2', name: 'file2.json', path: '/path2', mimeType: 'application/json', size: 34, source: 'web' }),
    ];

    await store.sendPrompt('hello', attachments);

    const message = store.messages[0];

    expect(message.role).toBe('user');
    expect(message.attachments).toHaveLength(2);
    expect(message.attachments).toEqual([
      {
        id: '1',
        name: 'file1.md',
        path: '/path1',
        mimeType: 'text/markdown',
        size: 12,
        source: 'local',
      },
      {
        id: '2',
        name: 'file2.json',
        path: '/path2',
        mimeType: 'application/json',
        size: 34,
        source: 'web',
      },
    ]);
  });

  it('stores attachment metadata only and no file body content', async () => {
    const store = await createReadyStore();
    const attachments = [
      makeAttachment({ id: '1', name: 'file1.md', path: '/path1' }),
    ];

    await store.sendPrompt('hello', attachments);

    const message = store.messages[0] as Record<string, unknown>;
    const storedAttachment = message.attachments as Array<Record<string, unknown>>;

    expect(message).not.toHaveProperty('fileContent');
    expect(message).not.toHaveProperty('body');
    expect(message).not.toHaveProperty('data');
    expect(message).not.toHaveProperty('base64');
    expect(message).not.toHaveProperty('blob');
    expect(storedAttachment).toHaveLength(1);
    expect(storedAttachment[0]).toEqual({
      id: '1',
      name: 'file1.md',
      path: '/path1',
      mimeType: 'application/octet-stream',
      size: 1024,
      source: 'local',
    });
  });

  it('leaves text-only messages without attachments', async () => {
    const store = await createReadyStore();

    await store.sendPrompt('hello');

    expect(store.messages[0].attachments).toBeUndefined();
  });

  it('treats an empty attachment array as no attachments', async () => {
    const store = await createReadyStore();

    await store.sendPrompt('hello', []);

    expect(store.messages[0].attachments).toBeUndefined();
  });
});
