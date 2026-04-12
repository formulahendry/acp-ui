import { open } from '@tauri-apps/plugin-dialog';
import { stat } from '@tauri-apps/plugin-fs';
import type { AttachmentRef } from './types';
import { getMimeType, ALLOWED_EXTENSIONS } from './attachments';

const defaultRawPicker = async (): Promise<string[] | null> => {
  const result = await open({
    multiple: true,
    title: 'Select Files to Attach',
    filters: [
      {
        name: 'Documents',
        extensions: ALLOWED_EXTENSIONS.map((extension) => extension.slice(1)),
      },
    ],
  });

  if (!result) {
    return null;
  }

  return Array.isArray(result) ? result : [result];
};

// Mockable picker seam for tests.
export let _rawPicker: () => Promise<string[] | null> = defaultRawPicker;

export function _setRawPicker(picker: () => Promise<string[] | null>): void {
  _rawPicker = picker;
}

export function _resetRawPicker(): void {
  _rawPicker = defaultRawPicker;
}

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export async function pickFiles(): Promise<AttachmentRef[]> {
  const paths = await _rawPicker();

  if (!paths || paths.length === 0) {
    return [];
  }

  const attachments: AttachmentRef[] = [];

  for (const filePath of paths) {
    const name = getFileName(filePath);
    const mimeType = getMimeType(name);

    let size = 0;
    try {
      const fileInfo = await stat(filePath);
      size = fileInfo.size;
    } catch {
      // Keep size at 0 when file metadata is unavailable.
    }

    attachments.push({
      id: crypto.randomUUID(),
      name,
      path: filePath,
      mimeType,
      size,
      source: 'local',
    });
  }

  return attachments;
}
