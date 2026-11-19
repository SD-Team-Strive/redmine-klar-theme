// =============================================================================
// Ticket-Ansicht: Betreff als Seitentitel
//
// Redmine zeigt über der Karte "Fehler #23" als Überschrift und den Betreff
// erst in der Karte. Hier wird der Betreff zur Überschrift; "Fehler #23"
// und der Status rücken als kleine Zeile (.issue-key) darunter.
//
// Der Betreff in der Karte bleibt im HTML (Redmines fixierte Kopfzeile beim
// Scrollen hängt an ihm) und wird per CSS nur visuell ausgeblendet.
//
// Gestaltung: src/scss/pages/_issue.scss ([data-issue-title],
// [data-subject-promoted], .issue-key)
// =============================================================================

function isIssuePage() {
  const { classList } = document.body;
  return classList.contains('controller-issues') && classList.contains('action-show');
}

function createKeyLine(title) {
  const key = document.createElement('p');
  key.className = 'issue-key';

  const label = document.createElement('span');
  label.className = 'issue-key-label';
  label.textContent = title.textContent.trim();
  key.appendChild(label);

  // Status-Badge ("offen"/"geschlossen") steht im HTML direkt nach dem Titel
  const badge = title.nextElementSibling;
  if (badge && badge.classList.contains('badge')) {
    key.appendChild(badge);
  }

  return key;
}

export function promoteIssueSubject() {
  if (!isIssuePage()) {
    return;
  }

  const content = document.getElementById('content');
  const title = content && content.querySelector(':scope > h2');
  const card = content && content.querySelector(':scope > div.issue.details');
  const subject = card && card.querySelector('div.subject h3');
  if (!title || !subject || title.hasAttribute('data-issue-title')) {
    return;
  }

  const key = createKeyLine(title);
  title.textContent = subject.textContent.trim();
  title.setAttribute('data-issue-title', '');
  title.insertAdjacentElement('afterend', key);
  card.setAttribute('data-subject-promoted', '');
}
