import { describe, expect, it } from 'vitest';
import { serializeAttachmentsToContentBlocks, toFileUri } from '../lib/attachments';
import type { AttachmentRef } from '../lib/types';

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

describe('attachment serialization', () => {
  it('serializes attachments into resource_link content blocks', () => {
    const attachments = [
      makeAttachment({ id: '1', name: 'notes.md', path: '/files/notes.md', mimeType: 'text/markdown' }),
      makeAttachment({ id: '2', name: 'data.json', path: '/files/data.json', mimeType: 'application/json' }),
    ];

    const blocks = serializeAttachmentsToContentBlocks(attachments);

    expect(blocks).toEqual([
      {
        type: 'resource_link',
        resource: {
          uri: 'file:///files/notes.md',
          name: 'notes.md',
          mimeType: 'text/markdown',
        },
      },
      {
        type: 'resource_link',
        resource: {
          uri: 'file:///files/data.json',
          name: 'data.json',
          mimeType: 'application/json',
        },
      },
    ]);
  });

  it('handles Windows paths', () => {
    expect(toFileUri('C:\\Users\\docs\\file.md')).toBe('file:///C%3A/Users/docs/file.md');
  });

  it('handles Unix paths', () => {
    expect(toFileUri('/home/user/docs/file.txt')).toBe('file:///home/user/docs/file.txt');
  });

  it('encodes spaces and unicode characters', () => {
    expect(toFileUri('/home/user/知识库 文档.pdf')).toBe('file:///home/user/%E7%9F%A5%E8%AF%86%E5%BA%93%20%E6%96%87%E6%A1%A3.pdf');
  });

  it('returns an empty array for no attachments', () => {
    expect(serializeAttachmentsToContentBlocks([])).toEqual([]);
  });

  it('serializes Windows file names with encoded uris', () => {
    const blocks = serializeAttachmentsToContentBlocks([
      makeAttachment({
        id: '3',
        name: '知识库 文档.pdf',
        path: 'C:\\Users\\me\\知识库 文档.pdf',
        mimeType: 'application/pdf',
      }),
    ]);

    expect(blocks[0]).toEqual({
      type: 'resource_link',
      resource: {
        uri: 'file:///C%3A/Users/me/%E7%9F%A5%E8%AF%86%E5%BA%93%20%E6%96%87%E6%A1%A3.pdf',
        name: '知识库 文档.pdf',
        mimeType: 'application/pdf',
      },
    });
  });
});
