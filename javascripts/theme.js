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

  // src/js/theme.js
  function init() {
    insertHeaderLogo();
    promoteIssueSubject();
    enableEditorLivePreview();
    insertFooterCredit();
    collapseQueryFilters();
  }
  claimBrandingLogo();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
