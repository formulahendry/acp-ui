import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import ChatView from '../components/ChatView.vue';
import { useSessionStore } from '../stores/session';
import type { AttachmentRef } from '../lib/types';

describe('ChatView History Attachments', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders history attachments for user messages with attachments', async () => {
    const store = useSessionStore();
    
    // Mock the state to contain a user message with attachments
    const mockAttachments: AttachmentRef[] = [
      { id: '1', name: 'document.pdf', path: '/foo/document.pdf', mimeType: 'application/pdf', size: 1024 * 1024 * 2.5, source: 'local' },
      { id: '2', name: 'image.png', path: '/foo/image.png', mimeType: 'image/png', size: 500 * 1024, source: 'local' }
    ];
    
    store.messages = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Check out these files',
        timestamp: Date.now(),
        attachments: mockAttachments
      }
    ];

    const wrapper = mount(ChatView);
    
    // Give time for Vue to render the computed messages
    await wrapper.vm.$nextTick();

    const historyAttachments = wrapper.find('.history-attachments');
    expect(historyAttachments.exists()).toBe(true);

    const chips = historyAttachments.findAll('.history-chip');
    expect(chips.length).toBe(2);

    expect(chips[0].find('.history-chip-name').text()).toBe('document.pdf');
    expect(chips[0].find('.history-chip-meta').text()).toBe('2.5 MB');
    
    expect(chips[1].find('.history-chip-name').text()).toBe('image.png');
    expect(chips[1].find('.history-chip-meta').text()).toBe('500 KB');
  });

  it('does not render an attachment container for messages without attachments', async () => {
    const store = useSessionStore();
    
    store.messages = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'No files here',
        timestamp: Date.now()
      }
    ];

    const wrapper = mount(ChatView);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.history-attachments').exists()).toBe(false);
  });

  it('formats zero size file properly', async () => {
    const store = useSessionStore();
    
    store.messages = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Empty file',
        timestamp: Date.now(),
        attachments: [{ id: '1', name: 'empty.txt', path: '/foo/empty.txt', mimeType: 'text/plain', size: 0, source: 'local' }]
      }
    ];

    const wrapper = mount(ChatView);
    await wrapper.vm.$nextTick();

    const chip = wrapper.find('.history-chip');
    expect(chip.find('.history-chip-meta').text()).toBe('0 B');
  });
});
