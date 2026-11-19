// =============================================================================
// Logo als Link im Kopf
//
// Redmine hat keinen Platz für ein Logo. Gesetzt wird ein verlinktes Logo
// vor den Seitentitel (Desktop) bzw. links in den mobilen Kopf.
//
//   Ziel:      1. vom Plugin redmine_branding per <meta name="branding-logo-link">
//                 (Vorgabe des Admins bzw. Einstellung des Benutzers)
//              2. sonst "Meine Seite" (angemeldet) bzw. die Hauptseite – Adresse
//                 und Beschriftung aus Redmines Links der oberen Leiste
//   Bild:      1. vom Plugin redmine_branding (Administration → Branding), das
//                 es per <meta name="branding-logo"> nennt
//              2. sonst CSS-Variable --theme-logo (images/logo.png im
//                 Theme-Ordner, siehe src/scss/layout/variables/_headerVariables.scss)
//   Fallback:  fehlt das Bild oder lädt es nicht, eine Kachel mit dem ersten
//              Buchstaben des Applikationstitels
//   Projekt:   auf Projektseiten auf dem Desktop stattdessen das Icon des
//              Projekts (Plugin redmine_project_icons, <meta name="project-icon">)
//              – eine Kachel statt zwei nebeneinander; mobil bleibt das Logo
//
// Vertrag mit redmine_branding: das Theme setzt data-branding-logo="theme"
// an <html> (claimBrandingLogo, sofort beim Laden des Scripts), dann setzt
// das Plugin kein eigenes Logo ein.
//
// Gestaltung: src/scss/layout/_header.scss, _mobileHeader.scss (.theme-logo)
// =============================================================================

// Sofort aufrufen (nicht erst bei DOMContentLoaded), damit das Plugin-Script
// das Attribut schon vorfindet
export function claimBrandingLogo() {
  document.documentElement.setAttribute('data-branding-logo', 'theme');
}

// Ziel als { href, label }
function findTarget() {
  const meta = document.querySelector('meta[name="branding-logo-link"]');
  if (meta?.content) {
    return { href: meta.content, label: meta.dataset.label || '' };
  }

  const link = document.querySelector('#top-menu a.my-page')
    || document.querySelector('#top-menu a.home');
  return { href: link ? link.href : '/', label: link ? link.textContent.trim() : '' };
}

// Seitentitel: "Seite - Projekt - Applikationstitel"
function applicationInitial() {
  const parts = document.title.split(' - ');
  const title = (parts[parts.length - 1] || '').trim();
  return title.charAt(0).toUpperCase() || 'R';
}

// Logo-Adresse: zuerst vom Plugin, sonst url("…") aus der CSS-Variablen;
// leer, wenn kein Logo gesetzt ist
function logoUrl() {
  const pluginLogo = document.querySelector('meta[name="branding-logo"]')?.content;
  if (pluginLogo) {
    return pluginLogo;
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--theme-logo').trim();
  const match = value.match(/^url\(["']?(.*?)["']?\)$/);
  return match ? match[1] : '';
}

// Projektseiten: Icon des Projekts (Plugin redmine_project_icons) –
// Bild, oder Kachel mit Anfangsbuchstabe in Projektfarbe
function projectIcon() {
  const meta = document.querySelector('meta[name="project-icon"]');
  if (!meta) {
    return null;
  }
  return { url: meta.content, color: meta.dataset.color || '', letter: meta.dataset.letter || '' };
}

// Eine Fläche der Kachel: Bild oder Anfangsbuchstabe
function face(className, url, letter) {
  const element = document.createElement('span');
  element.className = `theme-logo-face ${className}`;

  const showLetter = () => {
    element.textContent = letter;
    element.setAttribute('data-letter', '');
  };

  if (url) {
    const image = document.createElement('img');
    image.src = url;
    image.alt = '';
    image.addEventListener('error', () => {
      image.remove();
      showLetter();
    });
    element.appendChild(image);
  } else {
    showLetter();
  }
  return element;
}

// Kachel mit bis zu zwei Flächen: Logo der Installation und – auf
// Projektseiten – Projekt-Icon. Welche sichtbar ist, entscheidet das CSS:
// Desktop das Projekt-Icon, mobil immer das Logo (dort der einzige Weg
// zurück zur Startseite; das Projekt-Icon steht im Projekt-Dropdown).
export function insertHeaderLogo() {
  const header = document.getElementById('header');
  if (!header || header.querySelector('.theme-logo')) {
    return;
  }

  const target = findTarget();
  const link = document.createElement('a');
  link.className = 'theme-logo';
  link.href = target.href;
  if (target.label) {
    link.setAttribute('aria-label', target.label);
  }

  link.appendChild(face('theme-logo-instance', logoUrl(), applicationInitial()));

  const project = projectIcon();
  if (project) {
    const projectFace = face('theme-logo-project', project.url, project.letter);
    if (project.color) {
      projectFace.style.setProperty('--project-color', project.color);
    }
    link.appendChild(projectFace);
    link.setAttribute('data-project-icon', '');
  }

  header.insertBefore(link, header.firstChild);
}
