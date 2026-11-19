// =============================================================================
// Meine Seite: "Hinzufügen" als ein Knopf
//
// Redmine zeigt Beschriftung "Hinzufügen", einen Doppelpunkt und eine
// Auswahl mit leerem ersten Eintrag. Das Theme macht daraus einen Knopf
// "+ Hinzufügen" (Gestaltung: scss/pages/_myPage.scss). Hier:
//   - Redmines Icon "add" davor, wie bei "Neues Ticket"
//   - der leere Eintrag bekommt den Text der Beschriftung, value="" (Redmine
//     wählt ihn per val('') aus) und ist nicht wählbar (Platzhalter)
//   - die Auswahl wird so breit wie dieser Text – sonst richtet sie sich
//     nach dem längsten Blocknamen
//
// Redmine ersetzt die Auswahl nach jedem Hinzufügen/Entfernen eines Blocks
// (add_block.js) – deshalb wird bei jeder Änderung neu beschriftet.
// =============================================================================

function textWidth(text, element) {
  const context = document.createElement('canvas').getContext('2d');
  context.font = getComputedStyle(element).font;
  return context.measureText(text).width;
}

function labelPlaceholder(form) {
  const label = form.querySelector('label[for="block-select"]');
  const select = form.querySelector('#block-select');
  const placeholder = select?.querySelector(':scope > option:first-child');
  if (!label || !placeholder || placeholder.dataset.placeholder) {
    return;
  }

  const text = label.textContent.trim();
  placeholder.textContent = text;
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.dataset.placeholder = 'true';
  select.value = '';

  const style = getComputedStyle(select);
  const chrome = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']
    .reduce((sum, property) => sum + parseFloat(style[property]), 0);
  select.style.width = `${Math.ceil(textWidth(text, select) + chrome)}px`;
}

// Redmines Icon "add" (wie bei "Neues Ticket") vor die Auswahl; die Adresse
// des Icon-Sprites stammt von einem Icon der Seite (mit Digest)
function addIcon(form) {
  if (form.querySelector('.my-page-add-icon')) {
    return;
  }
  const sample = document.querySelector('svg.icon-svg use[href*="#icon--"]');
  if (!sample) {
    return;
  }
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 's18 icon-svg my-page-add-icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `${sample.getAttribute('href').split('#')[0]}#icon--add`);
  svg.appendChild(use);
  form.prepend(svg);
}

export function labelMyPageAddBlock() {
  const form = document.getElementById('block-form');
  if (!form) {
    return;
  }
  addIcon(form);
  // Nach Redmines eigenem ready-Handler ($('#block-select').val(''))
  const run = () => labelPlaceholder(form);
  if (window.jQuery) {
    window.jQuery(run);
  } else {
    run();
  }
  new MutationObserver(run).observe(form, { childList: true });
}
