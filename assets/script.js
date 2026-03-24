/* KB Site Generator — Client-side JavaScript
   Search, navigation, dark mode, code copy, Mermaid rendering */

(function () {
  "use strict";

  const BASE_URL = "";

  // ----------------------------------------------------------------
  // Dark mode toggle
  // ----------------------------------------------------------------

  function initTheme() {
    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;

    const saved = localStorage.getItem("kb-theme");
    if (saved) {
      document.documentElement.setAttribute("data-theme", saved);
      updateThemeIcon(toggle, saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
      updateThemeIcon(toggle, "dark");
    }

    toggle.addEventListener("click", function () {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("kb-theme", next);
      updateThemeIcon(toggle, next);
    });
  }

  function updateThemeIcon(btn, theme) {
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
    btn.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
    );
  }

  // ----------------------------------------------------------------
  // Sidebar toggle (mobile)
  // ----------------------------------------------------------------

  function initSidebar() {
    const toggle = document.getElementById("menu-toggle-btn");
    const sidebar = document.getElementById("sidebar");
    if (!toggle || !sidebar) return;

    toggle.addEventListener("click", function () {
      sidebar.classList.toggle("active");
      const expanded = sidebar.classList.contains("active");
      toggle.setAttribute("aria-expanded", expanded);
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener("click", function (e) {
      if (window.innerWidth <= 1024 && sidebar.classList.contains("active")) {
        if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
          sidebar.classList.remove("active");
          toggle.setAttribute("aria-expanded", "false");
        }
      }
    });
  }

  // ----------------------------------------------------------------
  // Folder expand/collapse in nav tree
  // ----------------------------------------------------------------

  function initNavFolders() {
    document.querySelectorAll(".folder-label").forEach(function (label) {
      label.addEventListener("click", function () {
        this.classList.toggle("open");
        const children = this.nextElementSibling;
        if (children) {
          if (this.classList.contains("open")) {
            children.style.maxHeight = children.scrollHeight + "px";
          } else {
            children.style.maxHeight = "0";
          }
        }
      });

      // Auto-expand folders containing the active page
      const children = label.nextElementSibling;
      if (children && children.querySelector(".active")) {
        label.classList.add("open");
        children.style.maxHeight = children.scrollHeight + "px";
      } else if (children) {
        children.style.maxHeight = "0";
      }
    });
  }

  // ----------------------------------------------------------------
  // Full-text search
  // ----------------------------------------------------------------

  let searchIndex = null;

  function initSearch() {
    const input = document.getElementById("search-input");
    const results = document.getElementById("search-results");
    if (!input || !results) return;

    // Load search index
    fetch(BASE_URL + "/search-index.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        searchIndex = data;
      })
      .catch(function (err) {
        console.warn("Search index not loaded:", err);
      });

    let debounce = null;
    input.addEventListener("input", function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        performSearch(input.value, results);
      }, 200);
    });

    input.addEventListener("focus", function () {
      if (input.value.length >= 2) performSearch(input.value, results);
    });

    // Close on outside click
    document.addEventListener("click", function (e) {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.classList.remove("active");
      }
    });

    // Keyboard navigation
    input.addEventListener("keydown", function (e) {
      const items = results.querySelectorAll(".search-result-item");
      const active = results.querySelector(".search-result-item.focused");
      let idx = Array.from(items).indexOf(active);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (active) active.classList.remove("focused");
        idx = (idx + 1) % items.length;
        items[idx].classList.add("focused");
        items[idx].scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (active) active.classList.remove("focused");
        idx = idx <= 0 ? items.length - 1 : idx - 1;
        items[idx].classList.add("focused");
        items[idx].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && active) {
        e.preventDefault();
        window.location.href = active.getAttribute("data-href");
      } else if (e.key === "Escape") {
        results.classList.remove("active");
        input.blur();
      }
    });
  }

  function performSearch(query, container) {
    if (!searchIndex || query.length < 2) {
      container.classList.remove("active");
      return;
    }

    const terms = query.toLowerCase().split(/\s+/);
    const scored = searchIndex
      .map(function (item) {
        let score = 0;
        const titleLow = item.title.toLowerCase();
        const bodyLow = item.body.toLowerCase();
        const tagsLow = (item.tags || "").toLowerCase();

        terms.forEach(function (term) {
          if (titleLow.includes(term)) score += 10;
          if (tagsLow.includes(term)) score += 5;
          if (bodyLow.includes(term)) score += 1;
        });

        return { item: item, score: score };
      })
      .filter(function (r) {
        return r.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, 8);

    if (scored.length === 0) {
      container.innerHTML =
        '<div class="search-result-item"><span class="result-title">No results found</span></div>';
      container.classList.add("active");
      return;
    }

    container.innerHTML = scored
      .map(function (r) {
        const snippet = highlightTerms(r.item.body.substring(0, 120), terms);
        return (
          '<div class="search-result-item" data-href="' +
          BASE_URL +
          "/" +
          r.item.slug +
          '/">' +
          '<div class="result-title">' +
          escapeHtml(r.item.title) +
          "</div>" +
          '<div class="result-snippet">' +
          snippet +
          "…</div>" +
          (r.item.tags
            ? '<div class="result-tags">' + escapeHtml(r.item.tags) + "</div>"
            : "") +
          "</div>"
        );
      })
      .join("");

    container.classList.add("active");

    // Click handlers
    container.querySelectorAll(".search-result-item").forEach(function (el) {
      el.addEventListener("click", function () {
        window.location.href = el.getAttribute("data-href");
      });
    });
  }

  function highlightTerms(text, terms) {
    let html = escapeHtml(text);
    terms.forEach(function (term) {
      const re = new RegExp(
        "(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")",
        "gi",
      );
      html = html.replace(re, "<mark>$1</mark>");
    });
    return html;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ----------------------------------------------------------------
  // Code copy buttons
  // ----------------------------------------------------------------

  function initCodeCopy() {
    document
      .querySelectorAll(".prose pre:not(.mermaid)")
      .forEach(function (pre) {
        const btn = document.createElement("button");
        btn.className = "copy-btn";
        btn.textContent = "Copy";
        btn.setAttribute("aria-label", "Copy code to clipboard");
        btn.addEventListener("click", function () {
          const code = pre.querySelector("code") || pre;
          navigator.clipboard.writeText(code.textContent).then(function () {
            btn.textContent = "Copied!";
            setTimeout(function () {
              btn.textContent = "Copy";
            }, 2000);
          });
        });
        pre.appendChild(btn);
      });
  }

  // ----------------------------------------------------------------
  // On-page TOC active heading tracking
  // ----------------------------------------------------------------

  function initTocTracking() {
    const tocLinks = document.querySelectorAll(".page-toc a");
    if (tocLinks.length === 0) return;

    const headings = Array.from(tocLinks)
      .map(function (link) {
        const id = link.getAttribute("href").replace("#", "");
        return document.getElementById(id);
      })
      .filter(Boolean);

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            tocLinks.forEach(function (l) {
              l.classList.remove("active");
            });
            const activeLink = document.querySelector(
              '.page-toc a[href="#' + entry.target.id + '"]',
            );
            if (activeLink) activeLink.classList.add("active");
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );

    headings.forEach(function (h) {
      observer.observe(h);
    });
  }

  // ----------------------------------------------------------------
  // Keyboard shortcut: / to focus search
  // ----------------------------------------------------------------

  function initKeyboardShortcuts() {
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (
          active &&
          (active.tagName === "INPUT" || active.tagName === "TEXTAREA")
        )
          return;
        e.preventDefault();
        var input = document.getElementById("search-input");
        if (input) input.focus();
      }
    });
  }

  // ----------------------------------------------------------------
  // Mermaid rendering
  // ----------------------------------------------------------------

  function initMermaid() {
    const mermaidBlocks = document.querySelectorAll("pre.mermaid");
    if (mermaidBlocks.length === 0) return;

    // Dynamically load Mermaid from CDN
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
    script.onload = function () {
      const isDark =
        document.documentElement.getAttribute("data-theme") === "dark";
      window.mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        securityLevel: "loose",
      });
      window.mermaid.run({ nodes: mermaidBlocks });
    };
    document.head.appendChild(script);
  }

  // ----------------------------------------------------------------
  // Boot
  // ----------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initSidebar();
    initNavFolders();
    initSearch();
    initCodeCopy();
    initTocTracking();
    initKeyboardShortcuts();
    initMermaid();
  });
})();