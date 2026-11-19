// =============================================================================
// Text-Editor: Vorschau ein/aus und live
//
// Ersetzt Redmines Reiter "Bearbeiten · Vorschau" durch einen Umschalter in
// der Werkzeugleiste. Eingeblendet steht die Vorschau – vom CSS entschieden
// (Container-Query in src/scss/components/_jstoolbar.scss) –
//   im breiten Editor rechts neben dem Text, im schmalen darunter.
// Das Textfeld bleibt immer sichtbar.
//
// Live: nach einer kurzen Tipppause wird der Text gerendert und eingesetzt.
// Dafür wird genau Redmines eigene Vorschau-Abfrage genutzt (POST an die
// data-url des Reiters "Vorschau", wie beim Klick darauf); es wird nichts
// geschrieben. Gerendert wird nur, wenn die Vorschau sichtbar ist.
//
// Der Zustand (data-editor-preview an <html>) gilt für alle Editoren und
// wird im Browser gemerkt. Beschriftung des Buttons = Redmines eigenes Wort
// für den Reiter "Vorschau".
// =============================================================================

const DEBOUNCE_MS = 400;
const STORAGE_KEY = 'klar-theme.editor-preview';
// Schlüssel aus Vorversionen des Themes: Wahl wird übernommen
const LEGACY_STORAGE_KEYS = ['stbt-theme.editor-preview', 'stbt-theme.editor-split'];
const timers = new WeakMap();
const lastRendered = new WeakMap();

// --- Einstellung ein/aus -----------------------------------------------------

function readPreviewPreference() {
  try {
    const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
    const value = keys.map((key) => localStorage.getItem(key)).find((stored) => stored !== null);
    return value !== 'off';
  } catch {
    return true;
  }
}

function applyPreviewPreference(enabled) {
  document.documentElement.setAttribute('data-editor-preview', enabled ? 'on' : 'off');
  document.querySelectorAll('.tab-split-toggle').forEach((button) => {
    button.setAttribute('aria-pressed', String(enabled));
  });
}

function savePreviewPreference(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Speicher nicht verfügbar (privates Fenster): gilt nur für diese Seite
  }
}

function insertToggle(block) {
  const list = block.querySelector('.jstTabs > ul');
  if (!list || list.querySelector('.tab-split')) {
    return;
  }

  const label = block.querySelector('a.tab-preview')?.textContent.trim() || '';
  const item = document.createElement('li');
  item.className = 'tab-split';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tab-split-toggle';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(readPreviewPreference()));
  button.addEventListener('click', () => {
    const enabled = button.getAttribute('aria-pressed') !== 'true';
    savePreviewPreference(enabled);
    applyPreviewPreference(enabled);
    if (enabled) {
      lastRendered.delete(block);
      schedule(block);
    }
  });

  item.appendChild(button);
  list.appendChild(item);
}

// Vorschau sichtbar (neben oder unter dem Text)?
function isPreviewVisible(block) {
  const textarea = block.querySelector('textarea.wiki-edit');
  const preview = block.querySelector('.wiki-preview');
  return Boolean(textarea && preview)
    && getComputedStyle(textarea).display !== 'none'
    && getComputedStyle(preview).display !== 'none';
}

// Wie Redmine: Text + Anhänge + markierte Zusatzfelder des Formulars
function previewBody(block, text) {
  const body = new URLSearchParams();
  body.append('text', text);

  const form = block.closest('form');
  if (form) {
    form.querySelectorAll('.attachments_fields input, [data-preview-param]').forEach((field) => {
      if (field.name && !field.disabled) {
        body.append(field.name, field.value);
      }
    });
  }
  return body;
}

async function renderPreview(block) {
  const textarea = block.querySelector('textarea.wiki-edit');
  const preview = block.querySelector('.wiki-preview');
  const url = block.querySelector('a.tab-preview')?.dataset.url;
  if (!textarea || !preview || !url) {
    return;
  }

  const text = textarea.value;
  if (lastRendered.get(block) === text) {
    return;
  }
  lastRendered.set(block, text);

  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      ...(token ? { 'X-CSRF-Token': token } : {}),
    },
    body: previewBody(block, text),
  });

  // Nur übernehmen, wenn inzwischen nicht weitergetippt wurde
  if (response.ok && lastRendered.get(block) === text) {
    preview.innerHTML = await response.text();
  }
}

function schedule(block) {
  clearTimeout(timers.get(block));
  timers.set(block, setTimeout(() => {
    if (isPreviewVisible(block)) {
      renderPreview(block).catch(() => lastRendered.delete(block));
    }
  }, DEBOUNCE_MS));
}

export function enableEditorLivePreview() {
  applyPreviewPreference(readPreviewPreference());
  document.querySelectorAll('.jstBlock').forEach(insertToggle);

  // Editoren, die später erscheinen (z. B. Kommentar bearbeiten), bekommen
  // den Umschalter ebenfalls
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return;
        }
        if (node.matches('.jstBlock')) {
          insertToggle(node);
        }
        node.querySelectorAll?.('.jstBlock').forEach(insertToggle);
      });
    }
  }).observe(document.body, { childList: true, subtree: true });

  // Delegiert: Editoren können nachträglich erscheinen (z. B. "Bearbeiten")
  document.addEventListener('input', (event) => {
    const block = event.target.closest?.('.jstBlock');
    if (block && event.target.matches('textarea.wiki-edit')) {
      schedule(block);
    }
  });

  // Erste Vorschau, sobald sie sichtbar ist
  // (beim Laden, beim Vergrößern des Fensters, beim Fokussieren)
  const renderVisible = () => {
    document.querySelectorAll('.jstBlock').forEach((block) => {
      if (isPreviewVisible(block)) {
        schedule(block);
      }
    });
  };

  document.addEventListener('focusin', (event) => {
    const block = event.target.closest?.('.jstBlock');
    if (block) {
      schedule(block);
    }
  });

  window.addEventListener('resize', () => {
    clearTimeout(timers.get(window));
    timers.set(window, setTimeout(renderVisible, DEBOUNCE_MS));
  });

  renderVisible();
}
