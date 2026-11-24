type MediaRow = {
  id: string;
  locale: 'en' | 'ar';
  alt_text: string;
  position: number;
  is_cover: boolean;
  mime_type: string;
  byte_size: number;
  width: number;
  height: number;
};

type JsonResult = Record<string, unknown> | null;

async function requestJson(path: string, init?: RequestInit): Promise<JsonResult> {
  const response = await fetch(path, { credentials: 'same-origin', ...init });
  let result: JsonResult = null;
  try {
    result = await response.json() as JsonResult;
  } catch {
    result = null;
  }
  if (!response.ok) {
    const reason = typeof result?.error === 'string' ? result.error : `Request failed (${response.status}).`;
    throw new Error(reason);
  }
  return result;
}

function button(text: string, action: string, disabled = false) {
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = text;
  control.dataset.action = action;
  control.disabled = disabled;
  return control;
}

export function initializePropertyMediaManager() {
  const root = document.querySelector<HTMLElement>('[data-media-manager]');
  if (!root) return;

  const revisionSelect = root.querySelector<HTMLSelectElement>('[data-media-revision]');
  const uploadForm = root.querySelector<HTMLFormElement>('[data-media-upload]');
  const uploadRevision = root.querySelector<HTMLInputElement>('[data-upload-revision]');
  const list = root.querySelector<HTMLOListElement>('[data-media-list]');
  const status = root.querySelector<HTMLElement>('[data-media-status]');
  if (!revisionSelect || !uploadForm || !uploadRevision || !list || !status) return;
  const revisionPicker = revisionSelect;
  const upload = uploadForm;
  const revisionInput = uploadRevision;
  const mediaList = list;
  const liveStatus = status;

  let busy = false;
  let rows: MediaRow[] = [];
  let loadId = 0;

  const say = (message: string) => { liveStatus.textContent = message; };
  const setBusy = (value: boolean) => {
    busy = value;
    root.querySelectorAll<HTMLButtonElement>('button').forEach((control) => { control.disabled = value; });
  };
  const metadata = (row: MediaRow, position = row.position, isCover = row.is_cover) => ({
    alt_text: row.alt_text,
    position,
    is_cover: isCover,
  });

  async function save(row: MediaRow, next: { alt_text: string; position: number; is_cover: boolean }) {
    if (busy) return;
    setBusy(true);
    try {
      await requestJson(`/api/admin/media/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      await load();
      say('Image details saved.');
    } catch (error) {
      say(error instanceof Error ? error.message : 'Image details could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  function render() {
    mediaList.replaceChildren();
    rows.forEach((row, index) => {
      const item = document.createElement('li');
      const details = document.createElement('p');
      details.textContent = `${row.mime_type}, ${Math.round(row.byte_size / 1024)} KiB, ${row.width} × ${row.height}${row.is_cover ? ' — Cover image' : ''}`;
      item.append(details);

      const label = document.createElement('label');
      label.textContent = `Alternative text (${row.locale}) `;
      const altText = document.createElement('input');
      altText.type = 'text';
      altText.maxLength = 500;
      altText.required = true;
      altText.lang = row.locale;
      altText.value = row.alt_text;
      label.append(altText);
      item.append(label, document.createTextNode(' '));

      const saveButton = button('Save alt text', 'save-alt');
      saveButton.addEventListener('click', () => save(row, { ...metadata(row), alt_text: altText.value }));
      item.append(saveButton, document.createTextNode(' '));

      const up = button('Move up', 'move-up', index === 0);
      up.addEventListener('click', () => save(row, metadata(row, rows[index - 1].position)));
      const down = button('Move down', 'move-down', index === rows.length - 1);
      down.addEventListener('click', () => save(row, metadata(row, rows[index + 1].position)));
      item.append(up, document.createTextNode(' '), down, document.createTextNode(' '));

      const cover = button(row.is_cover ? 'Cover image' : 'Set as cover', 'cover', row.is_cover);
      cover.addEventListener('click', () => save(row, metadata(row, row.position, true)));
      item.append(cover, document.createTextNode(' '));

      const remove = button('Delete image', 'delete');
      remove.addEventListener('click', async () => {
        if (busy || !window.confirm('Delete this image from the revision?')) return;
        setBusy(true);
        try {
          await requestJson(`/api/admin/media/${encodeURIComponent(row.id)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          });
          await load();
          say('Image deleted.');
        } catch (error) {
          say(error instanceof Error ? error.message : 'Image could not be deleted.');
        } finally {
          setBusy(false);
        }
      });
      item.append(remove);
      mediaList.append(item);
    });
    if (!rows.length) {
      const empty = document.createElement('li');
      empty.textContent = 'No images are attached to this revision.';
      mediaList.append(empty);
    }
  }

  async function load() {
    const currentLoad = ++loadId;
    const revision = revisionPicker.value;
    revisionInput.value = revision;
    rows = [];
    mediaList.replaceChildren();
    if (!revision) {
      say('Choose a property revision to manage its images.');
      return;
    }
    try {
      const result = await requestJson(`/api/admin/media?revision=${encodeURIComponent(revision)}`);
      if (currentLoad !== loadId) return;
      if (!Array.isArray(result?.media)) throw new Error('Media list is unavailable.');
      rows = result.media as MediaRow[];
      render();
      say(`${rows.length} image${rows.length === 1 ? '' : 's'} loaded.`);
    } catch (error) {
      if (currentLoad !== loadId) return;
      say(error instanceof Error ? error.message : 'Media list is unavailable.');
    }
  }

  revisionPicker.addEventListener('change', () => { void load(); });
  upload.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !revisionPicker.value) {
      say('Choose a property revision first.');
      return;
    }
    setBusy(true);
    say('Uploading image…');
    try {
      const data = new FormData(upload);
      data.set('revision', revisionPicker.value);
      await requestJson('/api/admin/media', { method: 'POST', body: data });
      upload.reset();
      await load();
      say('Image uploaded.');
    } catch (error) {
      say(error instanceof Error ? error.message : 'Image could not be uploaded.');
    } finally {
      setBusy(false);
    }
  });

  void load();
}
