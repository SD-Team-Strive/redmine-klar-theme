// =============================================================================
// Redmine-Theme Klar – Einstieg für javascripts/theme.js
//
// Redmine lädt aus einem Theme genau eine Datei automatisch:
// javascripts/theme.js (im <head>). Die Bausteine liegen deshalb getrennt
// in src/js/ und werden per `npm run build` zu dieser Datei gebündelt.
//
// Jeder Baustein ergänzt nur, was CSS allein nicht kann. Ohne JavaScript
// bleibt Redmine unverändert nutzbar.
//
//   headerLogo.js         Logo-Link im Kopf + Fallback-Kachel
//   issueSubjectTitle.js  Ticket-Ansicht: Betreff als Seitentitel
//   editorLivePreview.js  Text-Editor: Vorschau ein/aus und live
//   footerCredit.js       Footer: "Theme: Klar von stbt.de"
//   queryFilters.js       Listen: Filter eingeklappt mit Zusammenfassung
//   issueListMobile.js    Ticketliste mobil: ohne Doppeltes, Auswahl auf Wunsch
//   myPageAddBlock.js     Meine Seite: "Hinzufügen" als ein Knopf
//   dialogs.js            Dialoge: "Schließen" übersetzt, Kontextmenü zu
//   currentPage.js        Chili: current page in the menus (aria-current)
// =============================================================================

import { claimBrandingLogo, insertHeaderLogo } from './headerLogo.js';
import { promoteIssueSubject } from './issueSubjectTitle.js';
import { enableEditorLivePreview } from './editorLivePreview.js';
import { insertFooterCredit } from './footerCredit.js';
import { collapseQueryFilters } from './queryFilters.js';
import { enhanceIssueListMobile } from './issueListMobile.js';
import { labelMyPageAddBlock } from './myPageAddBlock.js';
import { enhanceDialogs } from './dialogs.js';
import { markCurrentPage } from './currentPage.js';

function init() {
  insertHeaderLogo();
  promoteIssueSubject();
  enableEditorLivePreview();
  insertFooterCredit();
  collapseQueryFilters();
  enhanceIssueListMobile();
  labelMyPageAddBlock();
  enhanceDialogs();
  markCurrentPage();
}

// Logo stellt das Theme selbst dar (Plugin redmine_branding fügt dann keins ein)
claimBrandingLogo();

// Script steht im <head>: erst starten, wenn das HTML da ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
