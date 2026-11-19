// =============================================================================
// Footer: Hinweis auf das Theme
//
// Hängt an Redmines eigenen Vermerk ("Powered by Redmine © …") an:
//   · Theme: Klar von stbt.de
// "Klar" verlinkt auf das Repository, "stbt.de" auf die Website.
// Redmines Vermerk bleibt unverändert stehen.
//
// Redmine schreibt den Footer immer englisch ("Powered by"); das Bindewort
// richtet sich nach der Seitensprache (Deutsch "von", sonst "by").
// =============================================================================

const THEME_NAME = 'Klar';
const THEME_URL = 'https://github.com/stbt-de/redmine-klar-theme';
const AUTHOR_NAME = 'stbt.de';
const AUTHOR_URL = 'https://stbt.de/';

const BY_WORD = { de: 'von' };
const DEFAULT_BY_WORD = 'by';

function externalLink(text, href) {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = text;
  return link;
}

export function insertFooterCredit() {
  const footer = document.getElementById('footer');
  if (!footer || footer.querySelector('.theme-credit')) {
    return;
  }

  const language = (document.documentElement.lang || '').slice(0, 2).toLowerCase();
  const byWord = BY_WORD[language] || DEFAULT_BY_WORD;

  const credit = document.createElement('span');
  credit.className = 'theme-credit';
  credit.append(
    'Theme: ',
    externalLink(THEME_NAME, THEME_URL),
    ` ${byWord} `,
    externalLink(AUTHOR_NAME, AUTHOR_URL),
  );

  // Redmines Text endet mit Zeilenumbruch/Leerzeichen – sonst stünde links
  // vom Mittelpunkt mehr Abstand als rechts
  const last = footer.lastChild;
  if (last && last.nodeType === Node.TEXT_NODE) {
    last.textContent = last.textContent.trimEnd();
  }

  footer.append(credit);
}
