// =============================================================================
// Listen-Filter: eingeklappt mit Zusammenfassung
//
// Redmine zeigt den Filterbereich jeder Liste (Tickets, Zeiten, Projekte …)
// immer ausgeklappt. Hier wird er beim Aufruf eingeklappt; in der Zeile
// "Filter" stehen die aktiven Filter kompakt:
//   › Filter   Status ist nicht: Gelöst, Erledigt · Zugewiesen an: ich
// Ein Klick klappt wie gewohnt auf (Redmines eigenes toggleFieldset). Ob der
// Bereich offen ist, wird im Browser gemerkt.
//
// Gestaltung: src/scss/pages/_query.scss (.query-filter-summary)
// =============================================================================

const STORAGE_KEY = 'klar-theme.query-filters';

function readOpen() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'open';
  } catch {
    return false;
  }
}

function saveOpen(open) {
  try {
    localStorage.setItem(STORAGE_KEY, open ? 'open' : 'closed');
  } catch {
    // Speicher nicht verfügbar (privates Fenster): gilt nur für diese Seite
  }
}

// Redmine schreibt Platzhalter wie "<< ich >>" – in der Zusammenfassung "ich"
function text(element) {
  return element
    ? element.textContent.replace(/\s+/g, ' ').trim().replace(/^<<\s*(.*?)\s*>>$/, '$1')
    : '';
}

// Werte eines Filters aus den Formularfeldern (nur sichtbare: bei "offen"
// oder "alle" blendet Redmine die Werte aus)
function filterValues(filter) {
  const holder = filter.querySelector('.values > span');
  if (!holder || holder.style.display === 'none') {
    return [];
  }

  const values = [];
  holder.querySelectorAll('select').forEach((select) => {
    [...select.selectedOptions].forEach((option) => values.push(text(option)));
  });
  holder.querySelectorAll('input:not([type="hidden"])').forEach((input) => {
    if (input.value.trim()) {
      values.push(input.value.trim());
    }
  });
  return values;
}

// "Status ist nicht: Gelöst, Erledigt" bzw. "Status: offen"
function describeFilter(filter) {
  const label = text(filter.querySelector('.field label'));
  const operatorSelect = filter.querySelector('.operator select');
  const operator = operatorSelect ? text(operatorSelect.selectedOptions[0]) : '';
  const values = filterValues(filter);

  if (!values.length) {
    return operator ? `${label}: ${operator}` : label;
  }
  // "ist" weglassen – "Zugewiesen an: ich" liest sich besser
  const isEquals = operatorSelect && operatorSelect.value === '=';
  return isEquals ? `${label}: ${values.join(', ')}` : `${label} ${operator}: ${values.join(', ')}`;
}

function buildSummary(fieldset) {
  return [...fieldset.querySelectorAll('#filters-table .filter')]
    .filter((filter) => filter.querySelector('.field input[type="checkbox"]')?.checked)
    .map(describeFilter)
    .filter(Boolean)
    .join(' · ');
}

function updateSummary(fieldset, legend) {
  let summary = legend.querySelector('.query-filter-summary');
  if (!summary) {
    summary = document.createElement('span');
    summary.className = 'query-filter-summary';
    legend.appendChild(summary);
  }
  const value = buildSummary(fieldset);
  summary.textContent = value;
  summary.title = value;
}

function setUp() {
  const fieldset = document.querySelector('#query_form fieldset#filters');
  const legend = fieldset?.querySelector(':scope > legend');
  if (!legend || typeof window.toggleFieldset !== 'function') {
    return;
  }

  updateSummary(fieldset, legend);

  if (!readOpen() && !fieldset.classList.contains('collapsed')) {
    window.toggleFieldset(legend);
  }

  // Nach Redmines eigenem Klick-Handler (onclick am legend): Zustand merken,
  // beim Einklappen die Zusammenfassung neu schreiben (Filter könnten sich
  // geändert haben)
  legend.addEventListener('click', () => {
    const open = !fieldset.classList.contains('collapsed');
    saveOpen(open);
    if (!open) {
      updateSummary(fieldset, legend);
    }
  });
}

export function collapseQueryFilters() {
  // Redmine baut die Filterzeilen in jQuery-ready-Handlern auf; danach starten
  if (window.jQuery) {
    window.jQuery(setUp);
  } else {
    setUp();
  }
}
