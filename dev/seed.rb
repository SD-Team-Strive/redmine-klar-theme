# Testdaten für die lokale Theme-Entwicklung.
# Aufruf: docker compose exec redmine bin/rails runner dev/seed.rb
#
# Idempotent: bricht ab, wenn das Demo-Projekt schon existiert.

if Project.exists?(identifier: 'website-relaunch')
  puts 'Testdaten existieren bereits.'
  exit
end

Redmine::DefaultData::Loader.load('de') unless Tracker.any?

Setting.ui_theme = 'klar'
Setting.default_language = 'de'
Setting.text_formatting = 'common_mark'
Setting.gravatar_enabled = '0'
Setting.app_title = 'Redmine'
Setting.welcome_text = "## Willkommen\n\nDies ist die lokale Testinstanz für das Theme Klar."

admin = User.find_by(login: 'admin')
admin.update!(must_change_passwd: false, language: 'de', firstname: 'Ada', lastname: 'Admin')
User.current = admin

def make_user(login, first, last)
  User.find_by(login: login) || User.create!(
    login: login, firstname: first, lastname: last, mail: "#{login}@example.test",
    password: 'password123', password_confirmation: 'password123', language: 'de'
  ) { |u| u.admin = false }
end

anna  = make_user('anna',  'Anna',  'Becker')
jonas = make_user('jonas', 'Jonas', 'Keller')
lea   = make_user('lea',   'Lea',   'Hoffmann')

manager   = Role.find_by(name: 'Manager')   || Role.givable.first
developer = Role.find_by(name: 'Entwickler') || Role.givable.second || manager

modules = %w[issue_tracking time_tracking news documents files wiki repository boards calendar gantt]

def make_project(identifier, name, description, modules, parent = nil)
  p = Project.new(identifier: identifier, name: name, description: description, is_public: true)
  p.parent = parent if parent
  p.trackers = Tracker.all
  p.enabled_module_names = modules
  p.save!
  p
end

web    = make_project('website-relaunch', 'Website Relaunch', 'Neuaufbau der Unternehmenswebsite mit Shopware 6 und modularem Frontend.', modules)
shop   = make_project('shop-integration', 'Shop-Integration', 'Anbindung von ERP und Warenwirtschaft.', modules, web)
intern = make_project('intern', 'Interne Organisation', 'Prozesse, Doku und Werkzeuge.', modules)
make_project('archiv-2024', 'Archiv 2024', 'Abgeschlossene Projekte.', modules).tap { |p| p.update_column(:status, Project::STATUS_CLOSED) }

[web, shop, intern].each do |p|
  Member.create!(project: p, principal: admin, roles: [manager])
  [anna, jonas].each { |u| Member.create!(project: p, principal: u, roles: [developer]) }
end
Member.create!(project: web, principal: lea, roles: [developer])

v1 = Version.create!(project: web, name: 'Sprint 12', effective_date: Date.today + 7, sharing: 'descendants')
v2 = Version.create!(project: web, name: 'Go-Live', effective_date: Date.today + 40, description: 'Produktivschaltung')
Version.create!(project: web, name: 'Sprint 11', effective_date: Date.today - 7, status: 'closed')

cat_frontend = IssueCategory.create!(project: web, name: 'Frontend', assigned_to: anna)
cat_backend  = IssueCategory.create!(project: web, name: 'Backend')
IssueCategory.create!(project: web, name: 'Inhalte')

cf = IssueCustomField.create!(name: 'Kunde', field_format: 'string', is_for_all: true, is_filter: true, trackers: Tracker.all)
IssueCustomField.create!(name: 'Aufwand freigegeben', field_format: 'bool', is_for_all: true, trackers: Tracker.all, edit_tag_style: 'check_box')

statuses   = IssueStatus.sorted.to_a
priorities = IssuePriority.active.to_a
trackers   = Tracker.sorted.to_a

subjects = [
  'Header-Navigation auf Mobilgeräten überarbeiten',
  'Produktfilter lädt bei mehr als 200 Artikeln zu langsam',
  'Checkout: Versandarten nach PLZ einschränken',
  'Styleguide für Buttons und Formulare ergänzen',
  'ERP-Export der Bestellungen schlägt nachts fehl',
  'Bilder im Blog werden nicht in WebP ausgeliefert',
  'Cookie-Hinweis entfernen, Tracking auf cookieless umstellen',
  'Suchergebnisseite: Leerzustand gestalten',
  'Newsletter-Anmeldung mit Double-Opt-in testen',
  'Kategorie-Teaser im CMS als eigenes Modul bauen',
  'Footer: Zahlungsarten-Logos aktualisieren',
  'Lighthouse-Score der Startseite über 90 bringen',
  'Redirects der alten URLs importieren',
  'Rechnungs-PDF: Logo wird abgeschnitten',
  'Barrierefreiheit: Fokus-Reihenfolge im Off-Canvas prüfen',
  'Staging-Umgebung auf PHP 8.3 aktualisieren',
  'Produktdaten-Import für Varianten erweitern',
  'Merkliste ohne Login ermöglichen',
]

issues = subjects.each_with_index.map do |subject, i|
  project = i % 5 == 4 ? shop : web
  issue = Issue.new(
    project: project, tracker: trackers[i % trackers.size], author: [admin, anna, jonas][i % 3],
    subject: subject, priority: priorities[i % priorities.size],
    assigned_to: [anna, jonas, nil, admin][i % 4],
    fixed_version: project == web ? [v1, v2, nil][i % 3] : nil,
    category: project == web ? [cat_frontend, cat_backend, nil][i % 3] : nil,
    start_date: Date.today - (i * 2), due_date: Date.today - (i * 2) + ((i % 5) + 1) * 4,
    estimated_hours: [2, 4, 8, 16, nil][i % 5], done_ratio: [0, 20, 50, 80, 100][i % 5],
    description: <<~MD
      Beim Testen auf dem iPhone ist aufgefallen, dass **#{subject.downcase}** noch offen ist.

      ### Schritte zum Nachvollziehen

      1. Startseite aufrufen
      2. Menü öffnen
      3. Auf `Kategorien` tippen

      ### Erwartet

      - Menü öffnet sich ohne Ruckeln
      - Fokus springt auf den ersten Eintrag

      > Hinweis: betrifft nur Safari, Chrome ist unauffällig.

      ```scss
      .navigation {
          display: flex;
          gap: 20px;
      }
      ```
    MD
  )
  issue.custom_field_values = { cf.id.to_s => %w[Nordlicht Seeblick Waldkauz][i % 3] }
  issue.save!
  issue
end

# Status, Kommentare und Zeiten nachträglich setzen, damit Journale entstehen
issues.each_with_index do |issue, i|
  issue = issue.reload
  issue.init_journal([anna, jonas, admin][i % 3], "Habe mir das angesehen. Ursache liegt im Template `header.html.twig`, Fix folgt.\n\nSiehe auch ##{issues[(i + 1) % issues.size].id}.")
  issue.status = statuses[i % statuses.size]
  issue.save!
  TimeEntry.create!(project: issue.project, issue: issue, user: issue.assigned_to || admin, author: admin,
                    hours: [0.5, 1.25, 3, 6][i % 4], spent_on: Date.today - (i % 6),
                    activity: TimeEntryActivity.first, comments: 'Analyse und Umsetzung')
end

# Unteraufgaben und Beziehungen
issues.each(&:reload)
issues[1].update!(parent_issue_id: issues[0].id)
issues[2].reload.update!(parent_issue_id: issues[0].id)
IssueRelation.create!(issue_from: issues[3].reload, issue_to: issues[8].reload, relation_type: 'relates')
IssueRelation.create!(issue_from: issues[5].reload, issue_to: issues[6].reload, relation_type: 'blocks')
issues[7].reload.update!(is_private: true)
Watcher.create!(watchable: issues[0], user: anna)
Watcher.create!(watchable: issues[0], user: jonas)

# Wiki
wiki = web.wiki || Wiki.create!(project: web, start_page: 'Wiki')
page = WikiPage.new(wiki: wiki, title: 'Wiki')
page.content = WikiContent.new(page: page, author: admin, text: <<~MD)
  # Projekt-Wiki

  Zentrale Dokumentation zum **Website Relaunch**. Stand: #{Date.today.strftime('%d.%m.%Y')}.

  {{toc}}

  ## Ziele

  Die neue Website soll schneller, zugänglicher und leichter zu pflegen sein. Wir messen das an
  Lighthouse, Conversion-Rate und dem Aufwand für Inhaltspflege.

  - Ladezeit unter 2 Sekunden
  - WCAG 2.2 AA
  - Inhalte ohne Entwickler pflegbar

  ## Zeitplan

  | Phase | Zeitraum | Verantwortlich |
  |-------|----------|----------------|
  | Konzept | KW 40–42 | Anna Becker |
  | Umsetzung | KW 43–49 | Jonas Keller |
  | Go-Live | KW 50 | Ada Admin |

  ## Technik

  ### Frontend

  Module bestehen aus Twig, SCSS und JS. Beispiel:

  ```javascript
  Env.Module.register('offCanvasCart', function (sandbox) {
      return { init: function () { sandbox.find('.toggle').on('click', open); } };
  });
  ```

  ### Deployment

  Deployment über `deployer` auf den Staging-Server, danach manuelle Abnahme.

  > Wichtig: Vor jedem Deployment den Cache leeren.

  ## Offene Fragen

  1. Wer pflegt die englischen Inhalte?
  2. Brauchen wir eine B2B-Preisliste?
     1. Falls ja: eigene Kundengruppe
     2. Falls nein: Rabattcodes

  ---

  Verwandte Seiten: [[Styleguide]], [[Deployment]]
MD
page.save!
%w[Styleguide Deployment].each do |title|
  p2 = WikiPage.new(wiki: wiki, title: title, parent: page)
  p2.content = WikiContent.new(page: p2, author: anna, text: "# #{title}\n\nInhalt folgt.")
  p2.save!
end

# News, Dokumente, Forum
News.create!(project: web, author: admin, title: 'Kickoff-Termin steht fest',
             summary: 'Der Kickoff findet am Montag um 10 Uhr statt.',
             description: "Bitte bis Freitag die Agenda-Punkte im Wiki ergänzen.\n\nOrt: Besprechungsraum 2 oder per Video.")
News.create!(project: intern, author: anna, title: 'Neue Zeiterfassung ab Dezember',
             summary: 'Zeiten bitte künftig direkt am Ticket buchen.', description: 'Details im Wiki.')

doc_cat = DocumentCategory.first
Document.create!(project: web, category: doc_cat, title: 'Angebot Relaunch', description: 'Finale Version nach Abstimmung.') if doc_cat

board = Board.create!(project: web, name: 'Allgemein', description: 'Fragen und Diskussionen rund um das Projekt')
topic = Message.create!(board: board, author: jonas, subject: 'Welche Schrift für die Headlines?', content: 'Inter oder doch eine Serif?')
Message.create!(board: board, author: anna, parent: topic, subject: 'RE: Welche Schrift für die Headlines?', content: 'Inter, passt zum Styleguide.')

# Gespeicherte Abfrage
IssueQuery.create!(name: 'Meine offenen Tickets', user: admin, visibility: IssueQuery::VISIBILITY_PRIVATE,
                   filters: { 'status_id' => { operator: 'o', values: [''] }, 'assigned_to_id' => { operator: '=', values: ['me'] } })

puts "Testdaten angelegt: #{Issue.count} Tickets, #{Project.count} Projekte."
