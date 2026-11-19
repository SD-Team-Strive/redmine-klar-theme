// Erzeugt aus src/js/ (npm run build:js) – nicht von Hand bearbeiten.
(() => {
  // src/js/headerLogo.js
  function claimBrandingLogo() {
    document.documentElement.setAttribute("data-branding-logo", "theme");
  }
  function findTarget() {
    const meta = document.querySelector('meta[name="branding-logo-link"]');
    if (meta?.content) {
      return { href: meta.content, label: meta.dataset.label || "" };
    }
    const link = document.querySelector("#top-menu a.my-page") || document.querySelector("#top-menu a.home");
    return { href: link ? link.href : "/", label: link ? link.textContent.trim() : "" };
  }
  function applicationInitial() {
    const parts = document.title.split(" - ");
    const title = (parts[parts.length - 1] || "").trim();
    return title.charAt(0).toUpperCase() || "R";
  }
  function logoUrl() {
    const pluginLogo = document.querySelector('meta[name="branding-logo"]')?.content;
    if (pluginLogo) {
      return pluginLogo;
    }
    const value = getComputedStyle(document.documentElement).getPropertyValue("--theme-logo").trim();
    const match = value.match(/^url\(["']?(.*?)["']?\)$/);
    return match ? match[1] : "";
  }
  function projectIcon() {
    const meta = document.querySelector('meta[name="project-icon"]');
    if (!meta) {
      return null;
    }
    return { url: meta.content, color: meta.dataset.color || "", letter: meta.dataset.letter || "" };
  }
  function face(className, url, letter) {
    const element = document.createElement("span");
    element.className = `theme-logo-face ${className}`;
    const showLetter = () => {
      element.textContent = letter;
      element.setAttribute("data-letter", "");
    };
    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = "";
      image.addEventListener("error", () => {
        image.remove();
        showLetter();
      });
      element.appendChild(image);
    } else {
      showLetter();
    }
    return element;
  }
  function insertHeaderLogo() {
    const header = document.getElementById("header");
    if (!header || header.querySelector(".theme-logo")) {
      return;
    }
    const target = findTarget();
    const link = document.createElement("a");
    link.className = "theme-logo";
    link.href = target.href;
    if (target.label) {
      link.setAttribute("aria-label", target.label);
    }
    link.appendChild(face("theme-logo-instance", logoUrl(), applicationInitial()));
    const project = projectIcon();
    if (project) {
      const projectFace = face("theme-logo-project", project.url, project.letter);
      if (project.color) {
        projectFace.style.setProperty("--project-color", project.color);
      }
      link.appendChild(projectFace);
      link.setAttribute("data-project-icon", "");
    }
    header.insertBefore(link, header.firstChild);
  }

  // src/js/issueSubjectTitle.js
  function isIssuePage() {
    const { classList } = document.body;
    return classList.contains("controller-issues") && classList.contains("action-show");
  }
  function createKeyLine(title) {
    const key = document.createElement("p");
    key.className = "issue-key";
    const label = document.createElement("span");
    label.className = "issue-key-label";
    label.textContent = title.textContent.trim();
    key.appendChild(label);
    const badge = title.nextElementSibling;
    if (badge && badge.classList.contains("badge")) {
      key.appendChild(badge);
    }
    return key;
  }
  function promoteIssueSubject() {
    if (!isIssuePage()) {
      return;
    }
    const content = document.getElementById("content");
    const title = content && content.querySelector(":scope > h2");
    const card = content && content.querySelector(":scope > div.issue.details");
    const subject = card && card.querySelector("div.subject h3");
    if (!title || !subject || title.hasAttribute("data-issue-title")) {
      return;
    }
    const key = createKeyLine(title);
    title.textContent = subject.textContent.trim();
    title.setAttribute("data-issue-title", "");
    title.insertAdjacentElement("afterend", key);
    card.setAttribute("data-subject-promoted", "");
  }

  // src/js/editorLivePreview.js
  var DEBOUNCE_MS = 400;
  var STORAGE_KEY = "klar-theme.editor-preview";
  var LEGACY_STORAGE_KEYS = ["stbt-theme.editor-preview", "stbt-theme.editor-split"];
  var timers = /* @__PURE__ */ new WeakMap();
  var lastRendered = /* @__PURE__ */ new WeakMap();
  function readPreviewPreference() {
    try {
      const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
      const value = keys.map((key) => localStorage.getItem(key)).find((stored) => stored !== null);
      return value !== "off";
    } catch {
      return true;
    }
  }
  function applyPreviewPreference(enabled) {
    document.documentElement.setAttribute("data-editor-preview", enabled ? "on" : "off");
    document.querySelectorAll(".tab-split-toggle").forEach((button) => {
      button.setAttribute("aria-pressed", String(enabled));
    });
  }
  function savePreviewPreference(enabled) {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
      LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {
    }
  }
  function insertToggle(block) {
    const list = block.querySelector(".jstTabs > ul");
    if (!list || list.querySelector(".tab-split")) {
      return;
    }
    const label = block.querySelector("a.tab-preview")?.textContent.trim() || "";
    const item = document.createElement("li");
    item.className = "tab-split";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab-split-toggle";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(readPreviewPreference()));
    button.addEventListener("click", () => {
      const enabled = button.getAttribute("aria-pressed") !== "true";
      savePreviewPreference(enabled);
      applyPreviewPreference(enabled);
      if (enabled) {
        lastRendered.delete(block);
        schedule(block);
      }
    });
    item.appendChild(button);
    list.appendChild(item);
  }
  function isPreviewVisible(block) {
    const textarea = block.querySelector("textarea.wiki-edit");
    const preview = block.querySelector(".wiki-preview");
    return Boolean(textarea && preview) && getComputedStyle(textarea).display !== "none" && getComputedStyle(preview).display !== "none";
  }
  function previewBody(block, text2) {
    const body = new URLSearchParams();
    body.append("text", text2);
    const form = block.closest("form");
    if (form) {
      form.querySelectorAll(".attachments_fields input, [data-preview-param]").forEach((field) => {
        if (field.name && !field.disabled) {
          body.append(field.name, field.value);
        }
      });
    }
    return body;
  }
  async function renderPreview(block) {
    const textarea = block.querySelector("textarea.wiki-edit");
    const preview = block.querySelector(".wiki-preview");
    const url = block.querySelector("a.tab-preview")?.dataset.url;
    if (!textarea || !preview || !url) {
      return;
    }
    const text2 = textarea.value;
    if (lastRendered.get(block) === text2) {
      return;
    }
    lastRendered.set(block, text2);
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    const response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        ...token ? { "X-CSRF-Token": token } : {}
      },
      body: previewBody(block, text2)
    });
    if (response.ok && lastRendered.get(block) === text2) {
      preview.innerHTML = await response.text();
    }
  }
  function schedule(block) {
    clearTimeout(timers.get(block));
    timers.set(block, setTimeout(() => {
      if (isPreviewVisible(block)) {
        renderPreview(block).catch(() => lastRendered.delete(block));
      }
    }, DEBOUNCE_MS));
  }
  function enableEditorLivePreview() {
    applyPreviewPreference(readPreviewPreference());
    document.querySelectorAll(".jstBlock").forEach(insertToggle);
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
          }
          if (node.matches(".jstBlock")) {
            insertToggle(node);
          }
          node.querySelectorAll?.(".jstBlock").forEach(insertToggle);
        });
      }
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("input", (event) => {
      const block = event.target.closest?.(".jstBlock");
      if (block && event.target.matches("textarea.wiki-edit")) {
        schedule(block);
      }
    });
    const renderVisible = () => {
      document.querySelectorAll(".jstBlock").forEach((block) => {
        if (isPreviewVisible(block)) {
          schedule(block);
        }
      });
    };
    document.addEventListener("focusin", (event) => {
      const block = event.target.closest?.(".jstBlock");
      if (block) {
        schedule(block);
      }
    });
    window.addEventListener("resize", () => {
      clearTimeout(timers.get(window));
      timers.set(window, setTimeout(renderVisible, DEBOUNCE_MS));
    });
    renderVisible();
  }

  // src/js/footerCredit.js
  var THEME_NAME = "Klar";
  var THEME_URL = "https://github.com/stbt-de/redmine-klar-theme";
  var AUTHOR_NAME = "stbt.de";
  var AUTHOR_URL = "https://stbt.de/";
  var BY_WORD = { de: "von" };
  var DEFAULT_BY_WORD = "by";
  function externalLink(text2, href) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = text2;
    return link;
  }
  function insertFooterCredit() {
    const footer = document.getElementById("footer");
    if (!footer || footer.querySelector(".theme-credit")) {
      return;
    }
    const language = (document.documentElement.lang || "").slice(0, 2).toLowerCase();
    const byWord = BY_WORD[language] || DEFAULT_BY_WORD;
    const credit = document.createElement("span");
    credit.className = "theme-credit";
    credit.append(
      "Theme: ",
      externalLink(THEME_NAME, THEME_URL),
      ` ${byWord} `,
      externalLink(AUTHOR_NAME, AUTHOR_URL)
    );
    const last = footer.lastChild;
    if (last && last.nodeType === Node.TEXT_NODE) {
      last.textContent = last.textContent.trimEnd();
    }
    footer.append(credit);
  }

  // src/js/queryFilters.js
  var STORAGE_KEY2 = "klar-theme.query-filters";
  function readOpen() {
    try {
      return localStorage.getItem(STORAGE_KEY2) === "open";
    } catch {
      return false;
    }
  }
  function saveOpen(open) {
    try {
      localStorage.setItem(STORAGE_KEY2, open ? "open" : "closed");
    } catch {
    }
  }
  function text(element) {
    return element ? element.textContent.replace(/\s+/g, " ").trim().replace(/^<<\s*(.*?)\s*>>$/, "$1") : "";
  }
  function filterValues(filter) {
    const holder = filter.querySelector(".values > span");
    if (!holder || holder.style.display === "none") {
      return [];
    }
    const values = [];
    holder.querySelectorAll("select").forEach((select) => {
      [...select.selectedOptions].forEach((option) => values.push(text(option)));
    });
    holder.querySelectorAll('input:not([type="hidden"])').forEach((input) => {
      if (input.value.trim()) {
        values.push(input.value.trim());
      }
    });
    return values;
  }
  function describeFilter(filter) {
    const label = text(filter.querySelector(".field label"));
    const operatorSelect = filter.querySelector(".operator select");
    const operator = operatorSelect ? text(operatorSelect.selectedOptions[0]) : "";
    const values = filterValues(filter);
    if (!values.length) {
      return operator ? `${label}: ${operator}` : label;
    }
    const isEquals = operatorSelect && operatorSelect.value === "=";
    return isEquals ? `${label}: ${values.join(", ")}` : `${label} ${operator}: ${values.join(", ")}`;
  }
  function buildSummary(fieldset) {
    return [...fieldset.querySelectorAll("#filters-table .filter")].filter((filter) => filter.querySelector('.field input[type="checkbox"]')?.checked).map(describeFilter).filter(Boolean).join(" \xB7 ");
  }
  function updateSummary(fieldset, legend) {
    let summary = legend.querySelector(".query-filter-summary");
    if (!summary) {
      summary = document.createElement("span");
      summary.className = "query-filter-summary";
      legend.appendChild(summary);
    }
    const value = buildSummary(fieldset);
    summary.textContent = value;
    summary.title = value;
  }
  function setUp() {
    const fieldset = document.querySelector("#query_form fieldset#filters");
    const legend = fieldset?.querySelector(":scope > legend");
    if (!legend || typeof window.toggleFieldset !== "function") {
      return;
    }
    updateSummary(fieldset, legend);
    if (!readOpen() && !fieldset.classList.contains("collapsed")) {
      window.toggleFieldset(legend);
    }
    legend.addEventListener("click", () => {
      const open = !fieldset.classList.contains("collapsed");
      saveOpen(open);
      if (!open) {
        updateSummary(fieldset, legend);
      }
    });
  }
  function collapseQueryFilters() {
    if (window.jQuery) {
      window.jQuery(setUp);
    } else {
      setUp();
    }
  }

  // src/js/issueListMobile.js
  var FILTER_COLUMNS = {
    status_id: "status",
    assigned_to_id: "assigned_to",
    project_id: "project",
    tracker_id: "tracker",
    author_id: "author",
    category_id: "category",
    fixed_version_id: "fixed_version"
  };
  var LABELS = {
    de: { select: "Ausw\xE4hlen", done: "Fertig" },
    en: { select: "Select", done: "Done" }
  };
  var LONG_PRESS_MS = 500;
  var LONG_PRESS_TOLERANCE_PX = 10;
  function labels() {
    const language = (document.documentElement.lang || "").slice(0, 2).toLowerCase();
    return LABELS[language] || LABELS.en;
  }
  function redundantColumns(form) {
    const columns = /* @__PURE__ */ new Set();
    const groupBy = form.querySelector("#group_by")?.value;
    if (groupBy) {
      columns.add(groupBy);
    }
    form.querySelectorAll("#filters-table .filter").forEach((filter) => {
      const column = FILTER_COLUMNS[filter.id.replace(/^tr_/, "")];
      const enabled = filter.querySelector('.field input[type="checkbox"]')?.checked;
      const operator = filter.querySelector(".operator select")?.value;
      const values = filter.querySelector(".values select");
      if (column && enabled && operator === "=" && values?.selectedOptions.length === 1) {
        columns.add(column);
      }
    });
    return [...columns];
  }
  function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) || "";
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
  }
  function decorateAssignees(table) {
    table.querySelectorAll("tbody td.assigned_to > a.user").forEach((link) => {
      if (link.querySelector(".list-user-initials")) {
        return;
      }
      const name = link.textContent.trim();
      const badge = document.createElement("span");
      badge.className = "list-user-initials";
      badge.setAttribute("aria-hidden", "true");
      badge.textContent = initials(name);
      const label = document.createElement("span");
      label.className = "list-user-name";
      label.textContent = name;
      link.title = name;
      link.replaceChildren(badge, label);
    });
  }
  function setSelection(table, button, on) {
    table.dataset.selection = on ? "on" : "off";
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.textContent = on ? labels().done : labels().select;
    if (!on && typeof window.contextMenuUnselectAll === "function") {
      window.contextMenuUnselectAll();
      window.contextMenuHide?.();
    }
  }
  function addSelectionToggle(table) {
    const actions = document.querySelector("#content > .contextual");
    if (!actions || actions.querySelector(".issue-list-select-toggle")) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "issue-list-select-toggle";
    button.addEventListener("click", () => {
      setSelection(table, button, table.dataset.selection !== "on");
    });
    actions.insertBefore(button, actions.querySelector(":scope > .drdn"));
    setSelection(table, button, false);
  }
  function enableLongPress(table) {
    let timer = null;
    let origin = null;
    let pressed = false;
    const cancel = () => {
      clearTimeout(timer);
      timer = null;
    };
    table.addEventListener("touchstart", (event) => {
      const row = event.target.closest("tr.hascontextmenu");
      if (!row || table.dataset.selection === "on" || event.touches.length !== 1) {
        return;
      }
      const touch = event.touches[0];
      origin = { x: touch.clientX, y: touch.clientY };
      pressed = false;
      timer = setTimeout(() => {
        const trigger = row.querySelector(".js-contextmenu");
        if (!trigger) {
          return;
        }
        pressed = true;
        trigger.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: origin.x,
          clientY: origin.y
        }));
      }, LONG_PRESS_MS);
    }, { passive: true });
    table.addEventListener("touchmove", (event) => {
      const touch = event.touches[0];
      if (origin && Math.hypot(touch.clientX - origin.x, touch.clientY - origin.y) > LONG_PRESS_TOLERANCE_PX) {
        cancel();
      }
    }, { passive: true });
    table.addEventListener("touchend", (event) => {
      cancel();
      if (pressed) {
        event.preventDefault();
      }
    });
    table.addEventListener("touchcancel", cancel);
    document.addEventListener("click", (event) => {
      if (!event.isTrusted) {
        return;
      }
      if (pressed) {
        event.preventDefault();
        event.stopPropagation();
      }
      pressed = false;
    }, true);
  }
  function setUp2() {
    const form = document.getElementById("query_form");
    document.querySelectorAll("table.list.issues").forEach((table2) => {
      decorateAssignees(table2);
    });
    document.querySelectorAll("#my-page table.list.issues").forEach((table2) => {
      table2.dataset.selection = "off";
      enableLongPress(table2);
    });
    if (!document.body.matches(".controller-issues.action-index") || !form) {
      return;
    }
    const table = document.querySelector("#content table.list.issues");
    if (!table) {
      return;
    }
    const hidden = redundantColumns(form);
    if (hidden.length) {
      table.dataset.mobileHide = hidden.join(" ");
    }
    addSelectionToggle(table);
    enableLongPress(table);
  }
  function enhanceIssueListMobile() {
    if (window.jQuery) {
      window.jQuery(setUp2);
    } else {
      setUp2();
    }
  }

  // src/js/myPageAddBlock.js
  function textWidth(text2, element) {
    const context = document.createElement("canvas").getContext("2d");
    context.font = getComputedStyle(element).font;
    return context.measureText(text2).width;
  }
  function labelPlaceholder(form) {
    const label = form.querySelector('label[for="block-select"]');
    const select = form.querySelector("#block-select");
    const placeholder = select?.querySelector(":scope > option:first-child");
    if (!label || !placeholder || placeholder.dataset.placeholder) {
      return;
    }
    const text2 = label.textContent.trim();
    placeholder.textContent = text2;
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.dataset.placeholder = "true";
    select.value = "";
    const style = getComputedStyle(select);
    const chrome = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"].reduce((sum, property) => sum + parseFloat(style[property]), 0);
    select.style.width = `${Math.ceil(textWidth(text2, select) + chrome)}px`;
  }
  function addIcon(form) {
    if (form.querySelector(".my-page-add-icon")) {
      return;
    }
    const sample = document.querySelector('svg.icon-svg use[href*="#icon--"]');
    if (!sample) {
      return;
    }
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "s18 icon-svg my-page-add-icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(ns, "use");
    use.setAttribute("href", `${sample.getAttribute("href").split("#")[0]}#icon--add`);
    svg.appendChild(use);
    form.prepend(svg);
  }
  function labelMyPageAddBlock() {
    const form = document.getElementById("block-form");
    if (!form) {
      return;
    }
    addIcon(form);
    const run = () => labelPlaceholder(form);
    if (window.jQuery) {
      window.jQuery(run);
    } else {
      run();
    }
    new MutationObserver(run).observe(form, { childList: true });
  }

  // src/js/dialogs.js
  var CLOSE_LABELS = { de: "Schlie\xDFen", en: "Close" };
  function enhanceDialogs() {
    const $ = window.jQuery;
    if (!$?.ui?.dialog) {
      return;
    }
    const language = (document.documentElement.lang || "").slice(0, 2).toLowerCase();
    $.ui.dialog.prototype.options.closeText = CLOSE_LABELS[language] || CLOSE_LABELS.en;
    $(document).on("dialogopen", () => {
      if (typeof window.contextMenuHide === "function") {
        window.contextMenuHide();
      }
    });
  }

  // src/js/theme.js
  function init() {
    insertHeaderLogo();
    promoteIssueSubject();
    enableEditorLivePreview();
    insertFooterCredit();
    collapseQueryFilters();
    enhanceIssueListMobile();
    labelMyPageAddBlock();
    enhanceDialogs();
  }
  claimBrandingLogo();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
