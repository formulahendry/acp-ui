import { describe, expect, it } from 'vitest';
import { ALLOWED_EXTENSIONS, MAX_FILE_COUNT, MAX_FILE_SIZE, getMimeType, validateAttachments } from '../lib/attachments';
import type { AttachmentRef } from '../lib/types';

function makeAttachment(overrides: Partial<AttachmentRef> & Pick<AttachmentRef, 'id' | 'name' | 'path'>): AttachmentRef {
  return {
    mimeType: getMimeType(overrides.name),
    size: 1024,
    source: 'local',
    ...overrides,
  };
}

describe('attachments helpers', () => {
  it('allows a valid multi-file set', () => {
    const candidates = [
      makeAttachment({ id: '1', name: 'notes.md', path: '/files/notes.md' }),
      makeAttachment({ id: '2', name: 'data.json', path: '/files/data.json' }),
      makeAttachment({ id: '3', name: 'table.csv', path: '/files/table.csv' }),
    ];

    const result = validateAttachments(candidates, []);

    expect(result.valid).toHaveLength(3);
    expect(result.rejected).toEqual([]);
  });

  it('rejects disallowed extensions', () => {
    const result = validateAttachments([makeAttachment({ id: '1', name: 'virus.exe', path: '/files/virus.exe' })], []);

    expect(result.valid).toEqual([]);
    expect(result.rejected).toEqual([{ name: 'virus.exe', reason: 'disallowed extension' }]);
  });

  it('rejects oversized files', () => {
    const result = validateAttachments(
      [makeAttachment({ id: '1', name: 'big.pdf', path: '/files/big.pdf', size: MAX_FILE_SIZE + 1 })],
      [],
    );

    expect(result.valid).toEqual([]);
    expect(result.rejected).toEqual([{ name: 'big.pdf', reason: 'file too large' }]);
  });

  it('rejects duplicate paths', () => {
    const existing = [makeAttachment({ id: 'existing', name: 'report.md', path: 'C:/Docs/Report.md' })];
    const result = validateAttachments(
      [makeAttachment({ id: '1', name: 'report.md', path: 'c:/docs/report.md' })],
      existing,
    );

    expect(result.valid).toEqual([]);
    expect(result.rejected).toEqual([{ name: 'report.md', reason: 'duplicate path' }]);
  });

  it('rejects attachments over the max count', () => {
    const existing = Array.from({ length: MAX_FILE_COUNT }, (_, index) =>
      makeAttachment({ id: `existing-${index}`, name: `existing-${index}.txt`, path: `/files/existing-${index}.txt` }),
    );

    const result = validateAttachments([
      makeAttachment({ id: '1', name: 'extra.txt', path: '/files/extra.txt' }),
    ], existing);

    expect(result.valid).toEqual([]);
    expect(result.rejected).toEqual([{ name: 'extra.txt', reason: 'too many attachments' }]);
  });

  it('maps extensions to mime types', () => {
    expect(getMimeType('doc.md')).toBe('text/markdown');
    expect(getMimeType('doc.txt')).toBe('text/plain');
    expect(getMimeType('doc.pdf')).toBe('application/pdf');
    expect(getMimeType('doc.doc')).toBe('application/msword');
    expect(getMimeType('doc.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(getMimeType('doc.json')).toBe('application/json');
    expect(getMimeType('doc.csv')).toBe('text/csv');
    expect(getMimeType('doc.unknown')).toBe('application/octet-stream');
  });

  it('returns valid and rejected arrays for mixed input', () => {
    const result = validateAttachments(
      [
        makeAttachment({ id: '1', name: 'ok.md', path: '/files/ok.md' }),
        makeAttachment({ id: '2', name: 'bad.exe', path: '/files/bad.exe' }),
        makeAttachment({ id: '3', name: 'large.pdf', path: '/files/large.pdf', size: MAX_FILE_SIZE + 1 }),
      ],
      [],
    );

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].name).toBe('ok.md');
    expect(result.rejected).toEqual([
      { name: 'bad.exe', reason: 'disallowed extension' },
      { name: 'large.pdf', reason: 'file too large' },
    ]);
  });

  it('returns empty arrays for no candidates', () => {
    const result = validateAttachments([], []);

    expect(result.valid).toEqual([]);
    expect(result.rejected).toEqual([]);
  });

  it('exports allowed extension list', () => {
    expect(ALLOWED_EXTENSIONS).toContain('.md');
  });
});
