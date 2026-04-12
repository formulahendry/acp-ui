import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import ChatView from '../components/ChatView.vue';
import { useSessionStore } from '../stores/session';
import { _setRawPicker, _resetRawPicker } from '../lib/file-picker';

describe('ChatView Composer Attachments', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    _resetRawPicker();
  });

  it('renders attach button', () => {
    const wrapper = mount(ChatView);
    expect(wrapper.find('.attach-btn').exists()).toBe(true);
  });

  it('selecting files shows chips', async () => {
    const wrapper = mount(ChatView);
    
    // Mock the file picker to return 2 files
    _setRawPicker(async () => ['/path/to/file1.txt', '/path/to/file2.md']);
    
    // Click attach button
    await wrapper.find('.attach-btn').trigger('click');
    
    // Wait for reactivity and async picker
    await new Promise(r => setTimeout(r, 50));
    
    const chips = wrapper.findAll('.attachment-chip');
    expect(chips.length).toBe(2);
    expect(chips[0].text()).toContain('file1.txt');
    expect(chips[1].text()).toContain('file2.md');
  });

  it('remove chip updates list', async () => {
    const wrapper = mount(ChatView);
    
    _setRawPicker(async () => ['/path/to/file1.txt', '/path/to/file2.md']);
    await wrapper.find('.attach-btn').trigger('click');
    await new Promise(r => setTimeout(r, 50));
    
    let chips = wrapper.findAll('.attachment-chip');
    expect(chips.length).toBe(2);
    
    // Click remove on the first chip
    await chips[0].find('.attachment-chip-remove').trigger('click');
    await new Promise(r => setTimeout(r, 10)); // allow Vue to re-render
    
    chips = wrapper.findAll('.attachment-chip');
    expect(chips.length).toBe(1);
    expect(chips[0].text()).toContain('file2.md');
  });

  it('send clears pending attachments and passes them to store', async () => {
    const wrapper = mount(ChatView);
    const store = useSessionStore();
    
    // Mock the store sendPrompt
    store.sendPrompt = vi.fn().mockResolvedValue(undefined);
    
    // Set text so send button is enabled
    await wrapper.find('textarea').setValue('Hello with files');
    
    // Add attachments
    _setRawPicker(async () => ['/path/to/file1.txt']);
    await wrapper.find('.attach-btn').trigger('click');
    await new Promise(r => setTimeout(r, 50));
    
    expect(wrapper.findAll('.attachment-chip').length).toBe(1);
    
    // Send
    await wrapper.find('.send-btn').trigger('click');
    await new Promise(r => setTimeout(r, 50));
    
    // Chips should be cleared
    expect(wrapper.findAll('.attachment-chip').length).toBe(0);
    
    // Store should have been called with text and attachments
    expect(store.sendPrompt).toHaveBeenCalledWith('Hello with files', expect.arrayContaining([
      expect.objectContaining({ name: 'file1.txt' })
    ]));
  });
});
