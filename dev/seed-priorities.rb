# Je ein offenes Ticket pro Priorität, um die Darstellung in der Liste zu prüfen.
# Aufruf: docker compose exec redmine bin/rails runner dev/seed-priorities.rb

project = Project.find_by!(identifier: 'website-relaunch')
author  = User.find_by!(login: 'admin')
User.current = author
status  = IssueStatus.find_by(is_closed: false) || IssueStatus.first

IssuePriority.active.sorted.each do |priority|
  subject = "Prioritätstest: #{priority.name}"
  next if Issue.exists?(project: project, subject: subject)

  Issue.create!(project: project, tracker: project.trackers.first, author: author,
                status: status, priority: priority, subject: subject,
                assigned_to: User.find_by(login: 'anna'))
end

IssuePriority.active.sorted.each do |p|
  puts "#{p.position}. #{p.name.ljust(10)} css: #{p.css_classes}#{p.is_default? ? '  (Standard)' : ''}"
end
