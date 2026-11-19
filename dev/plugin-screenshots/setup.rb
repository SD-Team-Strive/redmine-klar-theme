# frozen_string_literal: true

# Erfundene Daten für die Plugin-Screenshots (nach dev/seed.rb):
#   Branding       Logo und Favicon "Beispiel GmbH"
#   Avatars        abstrakte Profilbilder für Ada, Anna, Jonas und Lea
#   Project Icons  drei erfundene Kunden mit Unterprojekten und Tickets,
#                  Farb-Kacheln für die übrigen Projekte
#
# Aufruf: bin/rails runner dev/plugin-screenshots/setup.rb

FIXTURES = File.expand_path('fixtures', __dir__)

def upload(name)
  type = Marcel::MimeType.for(name: name)
  ActionDispatch::Http::UploadedFile.new(tempfile: File.open(File.join(FIXTURES, name), 'rb'), filename: name, type: type)
end

Setting.app_title = 'Beispiel GmbH'
Setting.ui_theme = 'klar'

# --- Branding -------------------------------------------------------------
RedmineBranding::Asset.new('logo').store!(upload('example-logo.svg'))
RedmineBranding::Asset.new('favicon').store!(upload('example-favicon.svg'))

# --- Avatars --------------------------------------------------------------
{ 'admin' => 'avatar-ada.png', 'anna' => 'avatar-anna.png', 'jonas' => 'avatar-jonas.png', 'lea' => 'avatar-lea.png' }.each do |login, file|
  RedmineAvatars::Avatar.new(User.find_by!(login: login)).store!(upload(file))
end

# --- Erfundene Kunden mit Unterprojekten ----------------------------------
admin = User.find_by!(login: 'admin')
people = %w[anna jonas lea admin].map { |login| User.find_by!(login: login) }
role = Role.givable.first
feature = Tracker.find_by(name: 'Feature') || Tracker.first
bug = Tracker.find_by(name: 'Fehler') || Tracker.last

def make_client_project(identifier, name, description, parent = nil)
  Project.find_by(identifier: identifier) || Project.create!(
    identifier: identifier, name: name, description: description, is_public: true, parent: parent,
    tracker_ids: Tracker.pluck(:id), enabled_module_names: Redmine::AccessControl.available_project_modules
  )
end

clients = {
  'nordlicht' => ['Nordlicht', 'Onlineshop für nachhaltige Outdoor-Bekleidung.', 'nordlicht.svg', '#0f766e',
                  [['nordlicht-shop', 'Nordlicht – Shop'], ['nordlicht-marketing', 'Nordlicht – Marketing']]],
  'seeblick' => ['Seeblick', 'Hotel am See: Website und Buchungsstrecke.', 'seeblick.svg', '#0e7490',
                 [['seeblick-betrieb', 'Seeblick – Betrieb']]],
  'waldkauz' => ['Waldkauz', 'Verlag für Naturbücher.', 'waldkauz.svg', '#4d7c0f', []]
}

subjects = [
  'Startseite: neue Bühne mit Kampagnenbild', 'Checkout: Versandarten nach Gewicht',
  'Newsletter-Anmeldung im Footer', 'Produktfilter für Größen ergänzen', 'Ladezeit der Kategorieseiten senken',
  'Impressum und Datenschutz aktualisieren'
]

clients.each_with_index do |(identifier, (name, description, icon, color, children)), index|
  root = make_client_project(identifier, name, description)
  projects = [root] + children.map { |child_id, child_name| make_client_project(child_id, child_name, nil, root) }

  icon_record = root.project_icon || root.build_project_icon
  icon_record.color = color
  icon_record.store_icon!(upload(icon))

  projects.each_with_index do |project, p_index|
    people.each { |user| Member.create!(project: project, user: user, roles: [role]) unless project.members.exists?(user_id: user.id) }
    next if project.issues.any?

    3.times do |n|
      Issue.create!(project: project, tracker: n.zero? ? bug : feature, author: admin,
                    assigned_to: people[(index + p_index + n) % people.size],
                    subject: subjects[(index * 2 + p_index + n) % subjects.size],
                    start_date: Date.today - n, due_date: Date.today + 2 + n * 2)
    end
  end
end

# Eigene Farbe ohne Icon: Kachel mit Anfangsbuchstabe
{ 'website-relaunch' => '#1d4ed8', 'intern' => '#475569' }.each do |identifier, color|
  project = Project.find_by!(identifier: identifier)
  (project.project_icon || project.build_project_icon).update!(color: color)
end

puts "Fertig: #{Project.count} Projekte, #{Issue.count} Tickets"
