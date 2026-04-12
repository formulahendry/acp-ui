import type { ContentBlock } from '@agentclientprotocol/sdk';
import type { AttachmentRef } from './types';

export const ALLOWED_EXTENSIONS = ['.md', '.txt', '.pdf', '.doc', '.docx', '.json', '.csv'] as const;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_FILE_COUNT = 10;

const MIME_TYPES: Record<string, string> = {
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.json': 'application/json',
  '.csv': 'text/csv',
};

export interface ValidationResult {
  valid: AttachmentRef[];
  rejected: Array<{ name: string; reason: string }>;
}

function getFileNameFromPath(filename: string): string {
  return filename.split(/[\\/]/).pop() ?? filename;
}

function getExtension(filename: string): string {
  const baseName = getFileNameFromPath(filename);
  const lastDotIndex = baseName.lastIndexOf('.');

  if (lastDotIndex <= 0) {
    return '';
  }

  return baseName.slice(lastDotIndex).toLowerCase();
}

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, '/').toLowerCase();
}

function isAllowedExtension(filename: string): boolean {
  const extension = getExtension(filename);
  return ALLOWED_EXTENSIONS.some((allowedExtension) => allowedExtension === extension);
}

export function getMimeType(filename: string): string {
  const extension = getExtension(filename);
  return MIME_TYPES[extension] ?? 'application/octet-stream';
}

export function validateAttachments(candidates: AttachmentRef[], existing: AttachmentRef[]): ValidationResult {
  const valid: AttachmentRef[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  const seenPaths = new Set(existing.map((attachment) => normalizePath(attachment.path)));
  let totalCount = existing.length;

  for (const candidate of candidates) {
    const candidatePath = normalizePath(candidate.path);

    if (!isAllowedExtension(candidate.name)) {
      rejected.push({ name: candidate.name, reason: 'disallowed extension' });
      continue;
    }

    if (candidate.size > MAX_FILE_SIZE) {
      rejected.push({ name: candidate.name, reason: 'file too large' });
      continue;
    }

    if (seenPaths.has(candidatePath)) {
      rejected.push({ name: candidate.name, reason: 'duplicate path' });
      continue;
    }

    if (totalCount >= MAX_FILE_COUNT) {
      rejected.push({ name: candidate.name, reason: 'too many attachments' });
      continue;
    }

    valid.push(candidate);
    seenPaths.add(candidatePath);
    totalCount += 1;
  }

  return { valid, rejected };
}

/**
 * Converts a local file path to a file:// URI.
 * Handles Windows paths (C:\foo\bar → file:///C:/foo/bar)
 * and encodes special characters (spaces, unicode).
 */
export function toFileUri(filePath: string): string {
  let normalized = filePath.replace(/\\/g, '/');

  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  const encoded = normalized.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return 'file://' + encoded;
}

/**
 * Serializes AttachmentRef[] into ACP-compatible content blocks.
 * Each attachment becomes a resource_link content block.
 */
export function serializeAttachmentsToContentBlocks(attachments: AttachmentRef[]): ContentBlock[] {
  return attachments.map((att) => ({
    type: 'resource_link' as const,
    resource: {
      uri: toFileUri(att.path),
      name: att.name,
      mimeType: att.mimeType,
    },
  }));
}
