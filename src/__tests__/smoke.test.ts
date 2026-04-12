import { describe, it, expect } from 'vitest';
import type { ChatMessage } from '../lib/types';

describe('smoke test', () => {
  it('can import types', () => {
    const msg: ChatMessage = {
      id: '1', role: 'user', content: 'hello', timestamp: Date.now(),
    };
    expect(msg.role).toBe('user');
  });
});
