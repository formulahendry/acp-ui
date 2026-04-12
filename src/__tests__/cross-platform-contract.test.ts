import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateAttachments, serializeAttachmentsToContentBlocks, toFileUri, getMimeType } from '../lib/attachments';
import { pickFiles, _setRawPicker, _resetRawPicker } from '../lib/file-picker';
import type { AttachmentRef } from '../lib/types';

vi.mock('@tauri-apps/plugin-fs', () => ({
  stat: vi.fn().mockResolvedValue({ size: 2048 }),
}));

function makeAttachment(overrides: Partial<AttachmentRef> & Pick<AttachmentRef, 'id' | 'name' | 'path'>): AttachmentRef {
  return {
    id: overrides.id,
    name: overrides.name,
    path: overrides.path,
    mimeType: overrides.mimeType ?? getMimeType(overrides.name),
    size: overrides.size ?? 2048,
    source: overrides.source ?? 'local',
  };
}

function withoutId(attachment: AttachmentRef): Omit<AttachmentRef, 'id'> {
  const { id: _id, ...rest } = attachment;
  return rest;
}

describe('cross-platform attachment contract', () => {
  afterEach(() => {
    _resetRawPicker();
  });

  it('desktop and web inputs normalize to equivalent contract', async () => {
    const desktopPaths = ['C:\\Users\\docs\\readme.md', 'C:\\Users\\docs\\data.csv'];
    const webPaths = ['/uploads/readme.md', '/uploads/data.csv'];

    _setRawPicker(async () => desktopPaths);
    const desktopAttachments = await pickFiles();

    _setRawPicker(async () => webPaths);
    const webAttachments = await pickFiles();

    expect(desktopAttachments).toHaveLength(2);
    expect(webAttachments).toHaveLength(2);
    expect(desktopAttachments.every((attachment) => typeof attachment.id === 'string')).toBe(true);
    expect(webAttachments.every((attachment) => typeof attachment.id === 'string')).toBe(true);

    expect(desktopAttachments.map(withoutId)).toEqual([
      {
        name: 'readme.md',
        path: 'C:\\Users\\docs\\readme.md',
        mimeType: 'text/markdown',
        size: 2048,
        source: 'local',
      },
      {
        name: 'data.csv',
        path: 'C:\\Users\\docs\\data.csv',
        mimeType: 'text/csv',
        size: 2048,
        source: 'local',
      },
    ]);

    expect(webAttachments.map(withoutId)).toEqual([
      {
        name: 'readme.md',
        path: '/uploads/readme.md',
        mimeType: 'text/markdown',
        size: 2048,
        source: 'local',
      },
      {
        name: 'data.csv',
        path: '/uploads/data.csv',
        mimeType: 'text/csv',
        size: 2048,
        source: 'local',
      },
    ]);
  });

  it('serializes multiple attachments into ACP resource_link blocks', () => {
    const attachments = [
      makeAttachment({ id: '1', name: 'notes.md', path: '/files/notes.md' }),
      makeAttachment({ id: '2', name: 'paper.pdf', path: '/files/paper.pdf' }),
      makeAttachment({ id: '3', name: 'table.csv', path: '/files/table.csv' }),
    ];

    const blocks = serializeAttachmentsToContentBlocks(attachments);

    expect(blocks).toHaveLength(3);
    expect(blocks).toEqual([
      {
        type: 'resource_link',
        uri: toFileUri('/files/notes.md'),
        name: 'notes.md',
        mimeType: 'text/markdown',
      },
      {
        type: 'resource_link',
        uri: toFileUri('/files/paper.pdf'),
        name: 'paper.pdf',
        mimeType: 'application/pdf',
      },
      {
        type: 'resource_link',
        uri: toFileUri('/files/table.csv'),
        name: 'table.csv',
        mimeType: 'text/csv',
      },
    ]);
  });

  it('accepts common document types and rejects disallowed types', () => {
    const allowedExtensions = ['.md', '.txt', '.pdf', '.doc', '.docx', '.json', '.csv'] as const;
    const allowedCandidates = allowedExtensions.map((extension, index) =>
      makeAttachment({
        id: `allowed-${index}`,
        name: `file-${index}${extension}`,
        path: `/files/file-${index}${extension}`,
      }),
    );

    const allowedResult = validateAttachments(allowedCandidates, []);

    expect(allowedResult.valid).toHaveLength(allowedExtensions.length);
    expect(allowedResult.rejected).toEqual([]);
    expect(allowedResult.valid.map((attachment) => attachment.name)).toEqual(
      allowedExtensions.map((extension, index) => `file-${index}${extension}`),
    );

    const rejectedCandidates = ['.exe', '.zip', '.dll'].map((extension, index) =>
      makeAttachment({
        id: `rejected-${index}`,
        name: `bad-${index}${extension}`,
        path: `/files/bad-${index}${extension}`,
      }),
    );

    const rejectedResult = validateAttachments(rejectedCandidates, []);

    expect(rejectedResult.valid).toEqual([]);
    expect(rejectedResult.rejected).toEqual([
      { name: 'bad-0.exe', reason: 'disallowed extension' },
      { name: 'bad-1.zip', reason: 'disallowed extension' },
      { name: 'bad-2.dll', reason: 'disallowed extension' },
    ]);
  });
});
