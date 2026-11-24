# Redmine theme list – Klar

Entry for https://www.redmine.org/projects/redmine/wiki/Theme_List (a wiki page:
sign in on redmine.org, *Edit*, insert the section below in alphabetical order, *Preview*,
*Save*). Format as in the legend at the end of that page: heading `h3`, one line of
description, then author, latest release, compatible Redmine versions, public SCM and
public ITS. Redmine Textile.

## Section

```textile
h3. Klar

* "Klar":https://github.com/stbt-de/redmine-klar-theme – a calm, clearly structured theme: neutral colours with a single yellow accent, the Inter typeface (self-hosted, no requests to Google Fonts), consistent spacing on a fixed grid and a reworked mobile view (compact issue list, long press for the context menu). Does not change Redmine's HTML; works with Redmine's own CSS as its foundation.
** Author: "stbt.de":https://stbt.de/
** Latest release: "1.2.4":https://github.com/stbt-de/redmine-klar-theme/releases/tag/v1.2.4 – 2026-11-24
** Compatible with: Redmine 7.0, 6.1
** Public SCM: https://github.com/stbt-de/redmine-klar-theme
** Public ITS: https://github.com/stbt-de/redmine-klar-theme/issues
** License: MIT
** Matching plugins: "Branding":https://github.com/stbt-de/redmine-branding, "Avatars":https://github.com/stbt-de/redmine-avatars, "Project Icons":https://github.com/stbt-de/redmine-project-icons, "Dashboard Blocks":https://github.com/stbt-de/redmine-dashboard-blocks
** Screenshots: "Issue list":https://raw.githubusercontent.com/stbt-de/redmine-klar-theme/main/docs/screenshots/issues.png, "Issue":https://raw.githubusercontent.com/stbt-de/redmine-klar-theme/main/docs/screenshots/issue.png, "Mobile":https://raw.githubusercontent.com/stbt-de/redmine-klar-theme/main/docs/screenshots/mobile-issues.png
```

## Notes

- Compatible versions: only what is listed under README → *Tested with* (7.0, 6.1).
- Underscores in inline code must be wrapped in `<code>…</code>`, not `@…@` – Redmine
  reads `_…_` as italics even there. The section above has none.
- Screenshots link to the public GitHub files; images can also be attached to the wiki
  page when editing (*Files*).

## Updating this entry

On a new release: edit the wiki page and change *Latest release* (version, date, link)
and, if it changed, *Compatible with*. Keep the date outside the link text – in
`"1.2.3 (date)":url` Textile turns the brackets into an invisible tooltip. Change this file
first, then copy it over.
