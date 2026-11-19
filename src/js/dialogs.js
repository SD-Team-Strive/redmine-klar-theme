// =============================================================================
// Dialoge (jQuery UI, Redmines showModal)
//
//   - Schließen-Knopf: jQuery UI beschriftet ihn fest englisch ("Close", auch
//     als Tooltip) – hier in der Sprache der Seite
//   - Ein offenes Kontextmenü (z. B. "Beobachter hinzufügen" aus dem Menü
//     der Ticketliste) schließt, sobald der Dialog aufgeht
//
// Gestaltung: scss/components/_dialogs.scss
// =============================================================================

const CLOSE_LABELS = { de: 'Schließen', en: 'Close' };

export function enhanceDialogs() {
  const $ = window.jQuery;
  if (!$?.ui?.dialog) {
    return;
  }

  const language = (document.documentElement.lang || '').slice(0, 2).toLowerCase();
  $.ui.dialog.prototype.options.closeText = CLOSE_LABELS[language] || CLOSE_LABELS.en;

  $(document).on('dialogopen', () => {
    if (typeof window.contextMenuHide === 'function') {
      window.contextMenuHide();
    }
  });
}
