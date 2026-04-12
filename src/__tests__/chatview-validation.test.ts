import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import ChatView from '../components/ChatView.vue';
import { _setRawPicker, _resetRawPicker } from '../lib/file-picker';
import { stat } from '@tauri-apps/plugin-fs';

const statMock = vi.mocked(stat);

function mockStats(entries: Record<string, number>): void {
  statMock.mockImplementation(async (path: string | URL) => ({
    size: entries[typeof path === 'string' ? path : path.toString()] ?? 0,
  } as never));
}

async function clickAttach(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.find('.attach-btn').trigger('click');
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 20));
}

describe('ChatView attachment validation', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    _resetRawPicker();
    statMock.mockReset();
  });

  it('rejects disallowed files and shows feedback', async () => {
    const wrapper = mount(ChatView);
    _setRawPicker(async () => ['/path/to/file.exe']);
    mockStats({ '/path/to/file.exe': 1024 });

    await clickAttach(wrapper);

    expect(wrapper.findAll('.attachment-chip')).toHaveLength(0);
    expect(wrapper.text()).toContain('file.exe: disallowed extension');
  });

  it('keeps valid attachments when an invalid selection is rejected', async () => {
    const wrapper = mount(ChatView);

    _setRawPicker(async () => ['/path/to/notes.md']);
    mockStats({ '/path/to/notes.md': 1024, '/path/to/bad.exe': 1024 });
    await clickAttach(wrapper);

    expect(wrapper.text()).toContain('notes.md');

    _setRawPicker(async () => ['/path/to/bad.exe']);
    await clickAttach(wrapper);

    expect(wrapper.text()).toContain('notes.md');
    expect(wrapper.text()).toContain('bad.exe: disallowed extension');
    expect(wrapper.findAll('.attachment-chip')).toHaveLength(1);
  });

  it('rejects files when the attachment limit is exceeded', async () => {
    const wrapper = mount(ChatView);
    const files = Array.from({ length: 10 }, (_, index) => `/path/to/file-${index + 1}.md`);

    _setRawPicker(async () => files);
    mockStats(Object.fromEntries(files.map((file) => [file, 1024])));
    await clickAttach(wrapper);

    expect(wrapper.findAll('.attachment-chip')).toHaveLength(10);

    _setRawPicker(async () => ['/path/to/extra.md']);
    mockStats({ '/path/to/extra.md': 1024 });
    await clickAttach(wrapper);

    expect(wrapper.text()).toContain('extra.md: too many attachments');
    expect(wrapper.findAll('.attachment-chip')).toHaveLength(10);
  });

  it('rejects duplicate files by path', async () => {
    const wrapper = mount(ChatView);

    _setRawPicker(async () => ['/path/to/file.md']);
    mockStats({ '/path/to/file.md': 1024, '/PATH/TO/FILE.md': 1024 });
    await clickAttach(wrapper);

    expect(wrapper.findAll('.attachment-chip')).toHaveLength(1);

    _setRawPicker(async () => ['/PATH/TO/FILE.md']);
    await clickAttach(wrapper);

    expect(wrapper.text()).toContain('FILE.md: duplicate path');
    expect(wrapper.findAll('.attachment-chip')).toHaveLength(1);
  });
});
