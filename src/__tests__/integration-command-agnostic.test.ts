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
  setActivePinia(createPinia());
  const { useSessionStore } = await import('../stores/session');
  const store = useSessionStore();
  await store.initStore();
  await store.createSession('Test Agent', 'D:/workspace');
  return store;
}

describe('attachment flow stays command agnostic', () => {
  beforeEach(() => {
    vi.resetModules();

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

  it('uses the same attachment prompt structure for slash commands and plain text', async () => {
    const inputTexts = ['/ingest some-text', '/query some-text', 'plain text'];
    const attachments = [
      makeAttachment({ id: '1', name: 'notes.md', path: 'C:/docs/notes.md', mimeType: 'text/markdown', size: 12 }),
      makeAttachment({ id: '2', name: 'table.csv', path: 'C:/docs/table.csv', mimeType: 'text/csv', size: 34 }),
    ];

    const recordedPrompts: unknown[] = [];
    const recordedMessageAttachments: AttachmentRef[][] = [];

    for (const text of inputTexts) {
      const store = await createReadyStore();
      await store.sendPrompt(text, attachments);

      const promptCall = mockPrompt.mock.calls[mockPrompt.mock.calls.length - 1]?.[0];
      recordedPrompts.push(promptCall?.prompt);
      recordedMessageAttachments.push(store.messages[0].attachments ?? []);
    }

    expect(recordedPrompts).toHaveLength(3);
    expect(recordedPrompts[0]).toEqual([
      { type: 'text', text: '/ingest some-text' },
      { type: 'resource_link', uri: 'file:///C%3A/docs/notes.md', name: 'notes.md', mimeType: 'text/markdown' },
      { type: 'resource_link', uri: 'file:///C%3A/docs/table.csv', name: 'table.csv', mimeType: 'text/csv' },
    ]);
    expect(recordedPrompts[1]).toEqual([
      { type: 'text', text: '/query some-text' },
      { type: 'resource_link', uri: 'file:///C%3A/docs/notes.md', name: 'notes.md', mimeType: 'text/markdown' },
      { type: 'resource_link', uri: 'file:///C%3A/docs/table.csv', name: 'table.csv', mimeType: 'text/csv' },
    ]);
    expect(recordedPrompts[2]).toEqual([
      { type: 'text', text: 'plain text' },
      { type: 'resource_link', uri: 'file:///C%3A/docs/notes.md', name: 'notes.md', mimeType: 'text/markdown' },
      { type: 'resource_link', uri: 'file:///C%3A/docs/table.csv', name: 'table.csv', mimeType: 'text/csv' },
    ]);

    for (const messageAttachments of recordedMessageAttachments) {
      expect(messageAttachments).toEqual(attachments);
    }
  });
});
