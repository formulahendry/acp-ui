import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stat } from '@tauri-apps/plugin-fs';
import { _resetRawPicker, _setRawPicker, pickFiles } from '../lib/file-picker';

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-fs', () => ({ stat: vi.fn() }));

beforeEach(() => {
  vi.mocked(stat).mockReset();
  _resetRawPicker();
});

describe('pickFiles', () => {
  it('normalizes multi-file selections into attachment refs', async () => {
    _setRawPicker(async () => ['C:/docs/readme.md', 'C:/docs/data.csv']);
    vi.mocked(stat).mockResolvedValueOnce({ size: 11 } as Awaited<ReturnType<typeof stat>>);
    vi.mocked(stat).mockResolvedValueOnce({ size: 22 } as Awaited<ReturnType<typeof stat>>);

    const attachments = await pickFiles();

    expect(attachments).toHaveLength(2);
    expect(attachments[0]).toMatchObject({
      name: 'readme.md',
      path: 'C:/docs/readme.md',
      mimeType: 'text/markdown',
      size: 11,
      source: 'local',
    });
    expect(attachments[1]).toMatchObject({
      name: 'data.csv',
      path: 'C:/docs/data.csv',
      mimeType: 'text/csv',
      size: 22,
      source: 'local',
    });
    expect(attachments[0].id).toBeTypeOf('string');
    expect(attachments[1].id).toBeTypeOf('string');
  });

  it('returns an empty array for cancel or null selection', async () => {
    _setRawPicker(async () => null);

    await expect(pickFiles()).resolves.toEqual([]);
  });

  it('returns an empty array for empty selection', async () => {
    _setRawPicker(async () => []);

    await expect(pickFiles()).resolves.toEqual([]);
  });

  it('normalizes a single-file selection', async () => {
    _setRawPicker(async () => ['D:/file.pdf']);
    vi.mocked(stat).mockResolvedValueOnce({ size: 4096 } as Awaited<ReturnType<typeof stat>>);

    const attachments = await pickFiles();

    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      name: 'file.pdf',
      path: 'D:/file.pdf',
      mimeType: 'application/pdf',
      size: 4096,
      source: 'local',
    });
  });

  it('keeps attachments when stat fails', async () => {
    _setRawPicker(async () => ['D:/file.pdf']);
    vi.mocked(stat).mockRejectedValueOnce(new Error('stat failed'));

    const attachments = await pickFiles();

    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      name: 'file.pdf',
      path: 'D:/file.pdf',
      mimeType: 'application/pdf',
      size: 0,
      source: 'local',
    });
  });
});
