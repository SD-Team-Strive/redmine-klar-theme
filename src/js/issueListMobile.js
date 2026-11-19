// =============================================================================
// Ticketliste mobil: ruhiger, mit Auswahl auf Wunsch
//
// Ergänzt, was CSS allein nicht kann (Gestaltung: scss/mobile/_lists.scss):
//
//   1. Überflüssige Spalten: Was die Abfrage für alle Zeilen festlegt –
//      Gruppierung oder Filter auf genau einen Wert ("Zugewiesen an: ich") –
//      steht nicht in jeder Zeile. Die Tabelle bekommt dafür
//      data-mobile-hide="status assigned_to …".
//   2. Zuständiger als Kreis mit Initialen (der Name bleibt für Screenreader).
//   3. "Auswählen": Checkbox und "⋯" erst auf Wunsch (data-selection).
//   4. Langer Druck auf eine Zeile öffnet Redmines Kontextmenü.
//
// Ohne JavaScript bleibt die Liste wie zuvor (Checkbox und "⋯" sichtbar).
// Auf dem Desktop ändert sich nichts sichtbar.
// =============================================================================

// Filter → Spalte der Liste
const FILTER_COLUMNS = {
  status_id: 'status',
  assigned_to_id: 'assigned_to',
  project_id: 'project',
  tracker_id: 'tracker',
  author_id: 'author',
  category_id: 'category',
  fixed_version_id: 'fixed_version',
};

const LABELS = {
  de: { select: 'Auswählen', done: 'Fertig' },
  en: { select: 'Select', done: 'Done' },
};

const LONG_PRESS_MS = 500;
const LONG_PRESS_TOLERANCE_PX = 10;

function labels() {
  const language = (document.documentElement.lang || '').slice(0, 2).toLowerCase();
  return LABELS[language] || LABELS.en;
}

// Spalten, deren Wert die Abfrage für alle Zeilen festlegt
function redundantColumns(form) {
  const columns = new Set();

  const groupBy = form.querySelector('#group_by')?.value;
  if (groupBy) {
    columns.add(groupBy);
  }

  // Redmine 7: div.filter, ältere Versionen: tr.filter
  form.querySelectorAll('#filters-table .filter').forEach((filter) => {
    const column = FILTER_COLUMNS[filter.id.replace(/^tr_/, '')];
    const enabled = filter.querySelector('.field input[type="checkbox"]')?.checked;
    const operator = filter.querySelector('.operator select')?.value;
    const values = filter.querySelector('.values select');
    if (column && enabled && operator === '=' && values?.selectedOptions.length === 1) {
      columns.add(column);
    }
  });

  return [...columns];
}

function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) || '';
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

// <a class="user">Anna Becker</a> → Kreis "AB" am Anfang der Meta-Zeile + Name (nur Screenreader, mobil)
function decorateAssignees(table) {
  table.querySelectorAll('tbody td.assigned_to > a.user').forEach((link) => {
    if (link.querySelector('.list-user-initials')) {
      return;
    }
    const name = link.textContent.trim();
    const badge = document.createElement('span');
    badge.className = 'list-user-initials';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = initials(name);

    const label = document.createElement('span');
    label.className = 'list-user-name';
    label.textContent = name;

    link.title = name;
    link.replaceChildren(badge, label);
  });
}

function setSelection(table, button, on) {
  table.dataset.selection = on ? 'on' : 'off';
  button.setAttribute('aria-pressed', on ? 'true' : 'false');
  button.textContent = on ? labels().done : labels().select;

  // Beim Beenden die Auswahl aufheben (Redmine markiert die Zeilen)
  if (!on && typeof window.contextMenuUnselectAll === 'function') {
    window.contextMenuUnselectAll();
    window.contextMenuHide?.();
  }
}

function addSelectionToggle(table) {
  const actions = document.querySelector('#content > .contextual');
  if (!actions || actions.querySelector('.issue-list-select-toggle')) {
    return;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'issue-list-select-toggle';
  button.addEventListener('click', () => {
    setSelection(table, button, table.dataset.selection !== 'on');
  });
  // Nach den Aktionen, vor dem "⋯"-Menü (die erste Aktion behält mobil
  // ihren Text, die übrigen werden zu Icons)
  actions.insertBefore(button, actions.querySelector(':scope > .drdn'));
  setSelection(table, button, false);
}

// Langer Druck: Redmines "⋯"-Link an der Druckstelle auslösen – dessen
// Handler öffnet das Kontextmenü dort und wählt die Zeile
function enableLongPress(table) {
  let timer = null;
  let origin = null;
  let pressed = false;

  const cancel = () => {
    clearTimeout(timer);
    timer = null;
  };

  table.addEventListener('touchstart', (event) => {
    const row = event.target.closest('tr.hascontextmenu');
    if (!row || table.dataset.selection === 'on' || event.touches.length !== 1) {
      return;
    }
    const touch = event.touches[0];
    origin = { x: touch.clientX, y: touch.clientY };
    pressed = false;
    timer = setTimeout(() => {
      const trigger = row.querySelector('.js-contextmenu');
      if (!trigger) {
        return;
      }
      pressed = true;
      trigger.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, view: window, clientX: origin.x, clientY: origin.y,
      }));
    }, LONG_PRESS_MS);
  }, { passive: true });

  table.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (origin && Math.hypot(touch.clientX - origin.x, touch.clientY - origin.y) > LONG_PRESS_TOLERANCE_PX) {
      cancel();
    }
  }, { passive: true });

  // Beim Loslassen nach dem langen Druck keinen Klick erzeugen: das Menü
  // liegt unter dem Finger, der Klick träfe sonst einen Menüeintrag (bzw.
  // öffnete das Ticket)
  table.addEventListener('touchend', (event) => {
    cancel();
    if (pressed) {
      event.preventDefault();
    }
  });
  table.addEventListener('touchcancel', cancel);

  // Falls der Browser trotzdem klickt: den ersten Klick danach verwerfen,
  // egal wo (Menü, Zeile)
  // (der eigene Klick auf "⋯" oben ist nicht "trusted" und zählt nicht)
  document.addEventListener('click', (event) => {
    if (!event.isTrusted) {
      return;
    }
    if (pressed) {
      event.preventDefault();
      event.stopPropagation();
    }
    pressed = false;
  }, true);
}

function setUp() {
  const form = document.getElementById('query_form');
  document.querySelectorAll('table.list.issues').forEach((table) => {
    decorateAssignees(table);
  });

  // Meine Seite: wie die Ticketliste ohne "⋯", Kontextmenü per langem Druck
  // (ohne "Auswählen" – Mehrfachauswahl gibt es dort nicht)
  document.querySelectorAll('#my-page table.list.issues').forEach((table) => {
    table.dataset.selection = 'off';
    enableLongPress(table);
  });

  // Ticketliste selbst (nicht Ticketbaum, Beziehungen)
  if (!document.body.matches('.controller-issues.action-index') || !form) {
    return;
  }
  const table = document.querySelector('#content table.list.issues');
  if (!table) {
    return;
  }

  const hidden = redundantColumns(form);
  if (hidden.length) {
    table.dataset.mobileHide = hidden.join(' ');
  }
  addSelectionToggle(table);
  enableLongPress(table);
}

export function enhanceIssueListMobile() {
  // Redmine baut die Filterzeilen in jQuery-ready-Handlern auf; danach starten
  if (window.jQuery) {
    window.jQuery(setUp);
  } else {
    setUp();
  }
}
