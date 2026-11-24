# frozen_string_literal: true

# Erfundene Daten für die Screenshots und das Video von Team Planning
# (nach dev/seed.rb und setup.rb):
#   Status "Zur Abrechnung" und Rolle "Abrechnung" für die Abschluss-Aktionen
#   Planung für Ada (laufende Woche, folgende Wochen, Später, Dauerthemen,
#   abgeschlossene Vorwoche mit Rückblick), Anna, Jonas und Lea für die Teamrunde,
#   Notizen der Runde, Block "Planung" auf Adas Meiner Seite
#
# Aufruf: bin/rails runner dev/plugin-screenshots/setup-team-planning.rb

admin = User.find_by!(login: 'admin')
anna, jonas, lea = %w[anna jonas lea].map { |login| User.find_by!(login: login) }
people = [admin, anna, jonas, lea]
User.current = admin
today = Date.today
monday = today - (today.cwday - 1)

# --- Rechte, Status, Rolle ---------------------------------------------------
Role.givable.each { |role| role.add_permission!(:use_team_planning, :view_others_team_planning) }
manager = Role.find_by(name: 'Manager') || Role.givable.first
manager.add_permission!(:edit_others_team_planning)

billing_status = IssueStatus.find_or_create_by!(name: 'Zur Abrechnung') { |s| s.is_closed = false }
closed_status = IssueStatus.where(is_closed: true).sorted.first
resolved_status = IssueStatus.find_by(name: 'Gelöst') || IssueStatus.where(is_closed: false).sorted.last
Tracker.all.each do |tracker|
  Role.givable.each do |role|
    IssueStatus.where.not(id: billing_status.id).each do |from|
      WorkflowTransition.find_or_create_by!(tracker: tracker, role: role, old_status: from, new_status: billing_status)
    end
  end
end

billing_role = Role.find_by(name: 'Abrechnung') || Role.create!(name: 'Abrechnung', permissions: %i[view_issues edit_issues add_issue_notes])

Setting.plugin_redmine_team_planning = RedmineTeamPlanning::Settings::DEFAULTS.merge(
  'done_actions' => [
    { 'id' => 'bill', 'label' => 'Abrechnen', 'status_id' => billing_status.id, 'assign' => "role:#{billing_role.id}",
      'comment' => '1', 'project_ids' => [] },
    { 'id' => 'done', 'label' => 'Fertig, ohne extra Rechnung', 'status_id' => closed_status.id, 'assign' => 'keep',
      'comment' => '0', 'project_ids' => [] },
    { 'id' => 'review', 'label' => 'Gelöst, zur Abnahme an Ersteller', 'status_id' => resolved_status.id,
      'assign' => 'author', 'comment' => '1', 'project_ids' => [] }
  ],
  'done_status_ids' => [closed_status.id, billing_status.id]
)

# --- Tickets -------------------------------------------------------------------
project = ->(identifier) { Project.find_by!(identifier: identifier) }
shop = project.('nordlicht-shop')
marketing = project.('nordlicht-marketing')
seeblick = project.('seeblick')
betrieb = project.('seeblick-betrieb')
waldkauz = project.('waldkauz')
intern = project.('intern')
web = project.('website-relaunch')

developer = Role.find_by(name: 'Entwickler') || Role.givable.second || manager
[shop, marketing, seeblick, betrieb, waldkauz, intern, web].each do |p|
  people.each { |user| Member.create!(project: p, principal: user, roles: [developer]) unless p.members.exists?(user_id: user.id) }
  Member.create!(project: p, principal: jonas, roles: [billing_role]) unless p.members.exists?(user_id: jonas.id)
  member = p.members.find_by(user_id: jonas.id)
  member.roles << billing_role unless member.roles.include?(billing_role)
end

feature = Tracker.find_by(name: 'Feature') || Tracker.first
bug = Tracker.find_by(name: 'Fehler') || Tracker.last
new_status = IssueStatus.sorted.first
in_progress = IssueStatus.find_by(name: 'In Bearbeitung') || new_status

# Beim erneuten Aufruf (nach dem Video) Status und Zuweisung zurücksetzen
def ticket(project, subject, assignee, tracker:, status:, author:)
  issue = Issue.find_by(project: project, subject: subject)
  if issue
    issue.update_columns(status_id: status.id, assigned_to_id: assignee&.id, closed_on: status.is_closed? ? Time.current : nil)
    return issue.reload
  end

  Issue.create!(project: project, subject: subject, tracker: tracker, status: status, author: author,
                assigned_to: assignee, priority: IssuePriority.default)
end

t = lambda do |p, subject, user, kind = feature, status = new_status|
  ticket(p, subject, user, tracker: kind, status: status, author: admin)
end

# Ada: laufende Woche
checkout = t.(shop, 'Checkout: Versand nach Gewicht berechnen', admin, feature, in_progress)
filter = t.(shop, 'Größenfilter in der Kategorie', admin, feature, in_progress)
booking = t.(seeblick, 'Buchungsstrecke: Zimmerwahl auf dem Handy', admin, bug, in_progress)
newsletter = t.(marketing, 'Newsletter-Vorlage Winterkampagne', admin)
catalog = t.(waldkauz, 'Verlagsprogramm Frühjahr als PDF', admin)
relaunch = t.(web, 'Relaunch: Inhalte migrieren', admin, feature, in_progress)
# Ada: folgende Wochen und Später
t_kw2 = [t.(shop, 'Gutscheine im Warenkorb', admin), t.(betrieb, 'Hotel-Bewertungen einbinden', admin),
         t.(intern, 'Vorlagen für Angebote überarbeiten', admin)]
t_kw3 = [t.(waldkauz, 'Leseproben als Blätterkatalog', admin)]
later = [t.(marketing, 'Social-Media-Bilder automatisch erzeugen', admin), t.(intern, 'Zeiterfassung auswerten', admin)]
# Ada: Dauerthemen
standings = [t.(intern, 'Wartung und Updates', admin), t.(marketing, 'Redaktionsplan Social Media', admin)]
# Ada: Backlog (zugewiesen, nicht eingeplant)
[t.(shop, 'Retourenformular vereinfachen', admin), t.(seeblick, 'Wetter-Widget auf der Startseite', admin),
 t.(betrieb, 'Rechnungsadresse im Buchungsformular', admin, bug), t.(waldkauz, 'Autorenseiten mit Foto', admin),
 t.(intern, 'Passwortmanager einführen', admin)]
# Pool (niemandem zugewiesen)
[t.(shop, 'Produktbilder komprimieren', nil), t.(seeblick, 'Anfahrt mit Karte', nil),
 t.(waldkauz, 'Neuerscheinungen im Newsletter', nil), t.(intern, 'Onboarding-Checkliste', nil)]
# Vorwoche (abgeschlossen)
past_done = [t.(shop, 'Versandkosten-Tabelle prüfen', admin, feature, closed_status),
             t.(seeblick, 'Saisonpreise eintragen', admin, feature, billing_status),
             t.(waldkauz, 'Impressum aktualisieren', admin, feature, closed_status)]

# Kolleginnen und Kollegen
plans = {
  anna => [[t.(shop, 'Warenkorb: Mengenrabatt anzeigen', anna, feature, in_progress), true],
           [t.(seeblick, 'Galerie der Zimmer', anna), false],
           [t.(marketing, 'Landingpage Winterkampagne', anna, feature, in_progress), false],
           [t.(intern, 'Styleguide: Formulare', anna), false]],
  jonas => [[t.(betrieb, 'Schnittstelle zum Kassensystem', jonas, feature, in_progress), false],
            [t.(shop, 'Lagerbestand stündlich abgleichen', jonas, bug), true],
            [t.(intern, 'Server auf neue Version heben', jonas), false]],
  lea => [[t.(waldkauz, 'Merkliste für Bücher', lea, feature, in_progress), false],
          [t.(web, 'Relaunch: Barrierefreiheit prüfen', lea), false]]
}
lea_standing = t.(intern, 'Support-Postfach', lea)

# --- Planung -------------------------------------------------------------------
TeamPlanningItem.delete_all
TeamPlanningPeriod.delete_all
TeamPlanningStanding.delete_all
TeamPlanningLaterItem.delete_all
TeamPlanningRound.delete_all

def period(user, starts_on, **attributes)
  TeamPlanningPeriod.create!(user: user, starts_on: starts_on, weeks: 1, **attributes)
end

def plan(period, issues, **attributes)
  issues.each_with_index do |issue, index|
    TeamPlanningItem.create!(period: period, issue: issue, position: index + 1, kind: 'normal', origin: 'planned',
                             **attributes)
  end
end

# Ada: KW davor, ebenfalls abgeschlossen (zum Blättern und für die Detailseite)
older = period(admin, monday - 14, closed_at: (monday - 7).to_time - 3600, focus: 'Saisonstart Hotel',
                                   review_good: "Zimmerfotos rechtzeitig vom Hotel bekommen.\nNewsletter-Entwurf in einem Rutsch abgestimmt.",
                                   review_bad: 'Checkout-Fehler erst am Freitag gefunden.',
                                   review_change: 'Kritische Strecken montags kurz durchklicken.')
plan(older, [past_done[1]], result: 'carried')
TeamPlanningItem.create!(period: older, issue: newsletter, position: 2, kind: 'normal', origin: 'planned', result: 'done', done: true)
TeamPlanningItem.create!(period: older, issue: filter, position: 3, kind: 'normal', origin: 'planned', result: 'backlog')

# Ada: Vorwoche mit Rückblick
past = period(admin, monday - 7, closed_at: monday.to_time - 3600,
                                 review_good: 'Saisonpreise früher fertig als gedacht.',
                                 review_bad: 'Zu viele kurzfristige Anfragen am Donnerstag.',
                                 review_change: 'Anfragen sammeln und zweimal am Tag beantworten.')
plan(past, past_done, result: 'done', done: true)
TeamPlanningItem.create!(period: past, issue: checkout, position: 4, kind: 'normal', origin: 'planned', result: 'carried')

# Ada: laufende Woche
current = period(admin, monday, focus: 'Checkout fertig, Winterkampagne vorbereiten')
TeamPlanningItem.create!(period: current, issue: checkout, position: 1, kind: 'normal', origin: 'carried', planned_hours: 6)
TeamPlanningItem.create!(period: current, issue: booking, position: 2, kind: 'normal', origin: 'planned', planned_hours: 4)
TeamPlanningItem.create!(period: current, issue: filter, position: 3, kind: 'normal', origin: 'planned')
TeamPlanningItem.create!(period: current, issue: newsletter, position: 4, kind: 'normal', origin: 'planned', planned_hours: 2)
TeamPlanningItem.create!(period: current, issue: relaunch, position: 5, kind: 'long', origin: 'planned',
                         until_on: monday + 21)
TeamPlanningItem.create!(period: current, issue: catalog, position: 6, kind: 'normal', origin: 'unplanned')
plan(period(admin, monday + 7), t_kw2)
plan(period(admin, monday + 14), t_kw3)
later.each_with_index { |issue, i| TeamPlanningLaterItem.create!(user: admin, issue: issue, position: i + 1) }
standings.each_with_index { |issue, i| TeamPlanningStanding.create!(user: admin, issue: issue, position: i + 1) }

# Kolleginnen und Kollegen: Vorwoche abgeschlossen, laufende Woche geplant
reviews = {
  anna => ['Landingpage-Entwurf kam gut an.', 'Abstimmung der Bilder dauerte lange.', 'Bilder früher anfragen.'],
  jonas => ['Kassensystem antwortet stabil.', 'Zwei Tage Störungen im Lager-Abgleich.', 'Abgleich überwachen.'],
  lea => ['Merkliste läuft im Test.', nil, nil]
}
plans.each do |user, entries|
  good, bad, change = reviews[user]
  period(user, monday - 7, closed_at: monday.to_time - 7200, review_good: good, review_bad: bad, review_change: change)
  p = period(user, monday, absence_days: user == lea ? 2 : 0,
                           focus: { anna => 'Winterkampagne', jonas => 'Kassensystem live' }[user])
  entries.each_with_index do |(issue, long), index|
    TeamPlanningItem.create!(period: p, issue: issue, position: index + 1, kind: long ? 'long' : 'normal', origin: 'planned')
  end
end
TeamPlanningStanding.create!(user: lea, issue: lea_standing, position: 1)
TeamPlanningStanding.create!(user: jonas, issue: standings.first, position: 1)

TeamPlanningRound.create!(held_on: monday - 7, notes: "Hotel braucht die Buchungsstrecke vor Weihnachten\nShop: Gutscheine erst im Januar")
TeamPlanningRound.create!(held_on: monday, notes: "Weihnachtspause: Shop-Updates bis 18.12. einspielen\nNeue Anfragen vom Hotel nächste Woche schätzen")

# --- Gebuchte Zeiten -----------------------------------------------------------
activity = TimeEntryActivity.shared.active.first
TimeEntry.where(user_id: admin.id, spent_on: (monday - 7)..).delete_all
book = lambda do |issue, date, hours|
  TimeEntry.create!(project: issue.project, issue: issue, user: admin, author: admin, hours: hours, spent_on: date,
                    activity: activity)
end
past_done.zip([3.0, 5.5, 1.0]).each_with_index { |(issue, hours), i| book.(issue, monday - 7 + i, hours) }
book.(checkout, monday - 3, 4.0)
book.(checkout, today, 2.5)
book.(booking, today, 1.5)
book.(catalog, today, 1.0)
book.(standings.first, today, 0.5)

# --- Meine Seite ---------------------------------------------------------------
admin.pref.my_page_layout = { 'top' => %w[team_plan], 'left' => %w[my_week], 'right' => %w[issue_status_tiles] }
admin.pref.save!

# Schon abgehakt (am Ende gesetzt, damit kein späteres Speichern es überschreibt)
Issue.where(id: catalog.id).update_all(status_id: billing_status.id)

puts "Fertig: Team Planning für #{people.size} Personen, #{TeamPlanningItem.count} Einträge, " \
     "#{catalog.subject}: #{catalog.reload.status.name}"
