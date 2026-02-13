/* ==========================================================================
 * AGENTSYS SITE - Main JavaScript
 * Vanilla JS, no dependencies. Handles:
 * - Scroll-triggered animations (IntersectionObserver)
 * - Navigation state (scroll, active section, mobile menu)
 * - Tab switching (commands, installation)
 * - Animated stat counters
 * - Terminal typing demo
 * - Copy-to-clipboard
 * ========================================================================== */

(function () {
  'use strict';

  // ========================================================================
  // SCROLL ANIMATIONS
  // ========================================================================

  function initScrollAnimations() {
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      // Make everything visible immediately
      document.querySelectorAll('.anim-fade-in, .anim-fade-up, .anim-fade-left').forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var delay = parseInt(entry.target.dataset.delay || '0', 10);
          setTimeout(function () {
            entry.target.classList.add('is-visible');
          }, delay);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.anim-fade-in, .anim-fade-up, .anim-fade-left').forEach(function (el) {
      observer.observe(el);
    });
  }

  // ========================================================================
  // NAVIGATION
  // ========================================================================

  function initNavigation() {
    var nav = document.getElementById('nav');
    var hamburger = document.getElementById('nav-hamburger');
    var mobileMenu = document.getElementById('mobile-menu');
    var mobileOverlay = document.getElementById('mobile-overlay');
    var navLinks = document.querySelectorAll('.nav__link');
    var mobileLinks = document.querySelectorAll('.mobile-menu__link');

    // Scroll state
    var lastScroll = 0;
    function onScroll() {
      var scrollY = window.scrollY;
      if (scrollY > 50) {
        nav.classList.add('is-scrolled');
      } else {
        nav.classList.remove('is-scrolled');
      }
      lastScroll = scrollY;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Active section tracking
    var sections = document.querySelectorAll('section[id]');
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          navLinks.forEach(function (link) {
            if (link.dataset.section === id) {
              link.classList.add('is-active');
            } else {
              link.classList.remove('is-active');
            }
          });
        }
      });
    }, { threshold: 0.3, rootMargin: '-60px 0px 0px 0px' });

    sections.forEach(function (section) {
      sectionObserver.observe(section);
    });

    // Mobile menu
    function openMenu() {
      hamburger.classList.add('is-open');
      hamburger.setAttribute('aria-expanded', 'true');
      hamburger.setAttribute('aria-label', 'Close menu');
      mobileMenu.classList.add('is-open');
      mobileMenu.setAttribute('aria-hidden', 'false');
      if (mobileOverlay) mobileOverlay.classList.add('is-visible');
      document.body.style.overflow = 'hidden';

      // Focus trap
      var focusableEls = mobileMenu.querySelectorAll('a[href]');
      if (focusableEls.length) {
        focusableEls[0].focus();
      }
    }

    function closeMenu() {
      hamburger.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
      hamburger.setAttribute('aria-label', 'Menu');
      mobileMenu.classList.remove('is-open');
      mobileMenu.setAttribute('aria-hidden', 'true');
      if (mobileOverlay) mobileOverlay.classList.remove('is-visible');
      document.body.style.overflow = '';
      hamburger.focus();
    }

    hamburger.addEventListener('click', function () {
      if (mobileMenu.classList.contains('is-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close on overlay click
    if (mobileOverlay) {
      mobileOverlay.addEventListener('click', closeMenu);
    }

    // Close on link click
    mobileLinks.forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    // Close on escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) {
        closeMenu();
      }
    });

    // Focus trap in mobile menu
    mobileMenu.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var focusableEls = mobileMenu.querySelectorAll('a[href]');
      if (!focusableEls.length) return;
      var first = focusableEls[0];
      var last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Smooth scroll for nav links (offset for fixed nav)
    var prefersReducedNav = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var target = document.querySelector(this.getAttribute('href'));
        if (target) {
          e.preventDefault();
          var offset = 70;
          var pos = target.getBoundingClientRect().top + window.scrollY - offset;
          if (prefersReducedNav) {
            window.scrollTo(0, pos);
          } else {
            window.scrollTo({ top: pos, behavior: 'smooth' });
          }
          target.focus({ preventScroll: true });
        }
      });
    });
  }

  // ========================================================================
  // TABS
  // ========================================================================

  function initTabs() {
    document.querySelectorAll('[role="tablist"]').forEach(function (tablist) {
      var tabs = tablist.querySelectorAll('[role="tab"]');
      var parentContainer = tablist.parentElement;

      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          activateTab(tablist, parentContainer, tab);
        });

        tab.addEventListener('keydown', function (e) {
          var index = parseInt(tab.dataset.index, 10);
          var newIndex;

          if (e.key === 'ArrowRight') {
            newIndex = (index + 1) % tabs.length;
          } else if (e.key === 'ArrowLeft') {
            newIndex = (index - 1 + tabs.length) % tabs.length;
          } else if (e.key === 'Home') {
            newIndex = 0;
          } else if (e.key === 'End') {
            newIndex = tabs.length - 1;
          }

          if (newIndex !== undefined) {
            e.preventDefault();
            activateTab(tablist, parentContainer, tabs[newIndex]);
            tabs[newIndex].focus();
          }
        });
      });
    });
  }

  function activateTab(tablist, container, activeTab) {
    var tabs = tablist.querySelectorAll('[role="tab"]');
    tabs.forEach(function (tab) {
      var isActive = tab === activeTab;
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.setAttribute('tabindex', isActive ? '0' : '-1');

      // Toggle the correct active class based on the tab's class list
      if (tab.classList.contains('agent-tabs__tab')) {
        tab.classList.toggle('agent-tabs__tab--active', isActive);
      } else {
        tab.classList.toggle('tabs__tab--active', isActive);
      }

      var panelId = tab.getAttribute('aria-controls');
      var panel = container.querySelector('#' + panelId);
      if (panel) {
        if (isActive) {
          panel.hidden = false;
          panel.classList.add('tabs__panel--active');
        } else {
          panel.hidden = true;
          panel.classList.remove('tabs__panel--active');
        }
      }
    });

    // Dispatch custom event so other features (e.g. dynamic HIW) can react
    tablist.dispatchEvent(new CustomEvent('tab-changed', {
      detail: { index: parseInt(activeTab.dataset.index, 10) }
    }));
  }

  // ========================================================================
  // STAT COUNTERS
  // ========================================================================

  function initCounters() {
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var counters = document.querySelectorAll('.stats__number');
    var animated = false;

    // Remove aria-live during animation to prevent excessive screen reader announcements
    counters.forEach(function (counter) {
      counter.removeAttribute('aria-live');
    });

    function animateCounters() {
      if (animated) return;
      animated = true;
      var completedCount = 0;

      counters.forEach(function (counter) {
        var target = parseInt(counter.dataset.target, 10);
        if (prefersReduced) {
          counter.textContent = formatNumber(target);
          counter.setAttribute('aria-live', 'polite');
          return;
        }

        var duration = 1500;
        var startTime = null;

        function step(timestamp) {
          if (!startTime) startTime = timestamp;
          var progress = Math.min((timestamp - startTime) / duration, 1);
          // Ease-out: fast start, slow finish
          var eased = 1 - Math.pow(1 - progress, 3);
          var current = Math.floor(eased * target);
          counter.textContent = formatNumber(current);

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            counter.textContent = formatNumber(target);
            completedCount++;
            // Restore aria-live only after all animations complete
            if (completedCount === counters.length) {
              counters.forEach(function (c) {
                c.setAttribute('aria-live', 'polite');
              });
            }
          }
        }

        requestAnimationFrame(step);
      });
    }

    function formatNumber(n) {
      return n.toLocaleString('en-US');
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounters();
          observer.disconnect();
        }
      });
    }, { threshold: 0.5 });

    var statsSection = document.getElementById('stats');
    if (statsSection) {
      observer.observe(statsSection);
    }
  }

  // ========================================================================
  // COPY TO CLIPBOARD
  // ========================================================================

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for older browsers / non-HTTPS
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        resolve();
      } catch (err) {
        reject(err);
      }
      document.body.removeChild(textarea);
    });
  }

  function initCopyButtons() {
    document.querySelectorAll('.code-block__copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var code = btn.dataset.code;
        if (!code) return;

        copyToClipboard(code).then(function () {
          btn.classList.add('is-copied');
          btn.setAttribute('aria-label', 'Copied');
          // Swap icon to checkmark
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>';

          setTimeout(function () {
            btn.classList.remove('is-copied');
            btn.setAttribute('aria-label', 'Copy code to clipboard');
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/></svg>';
          }, 2000);
        });
      });
    });
  }

  // ========================================================================
  // TERMINAL ANIMATION
  // ========================================================================

  function initTerminal() {
    var body = document.getElementById('terminal-body');
    if (!body) return;

    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isPaused = false;
    var animationTimeout = null;

    // Pause on hover
    var terminal = body.closest('.terminal');
    if (terminal) {
      terminal.addEventListener('mouseenter', function () {
        isPaused = true;
        terminal.classList.add('is-paused');
      });
      terminal.addEventListener('mouseleave', function () {
        isPaused = false;
        terminal.classList.remove('is-paused');
      });
    }

    // The demo sequence
    var sequence = [
      { type: 'type', text: '$ /next-task', delay: 0 },
      { type: 'wait', delay: 600 },
      { type: 'lines', lines: [
        { html: '<span class="t-cyan">[discovery]</span> Found 3 tasks from GitHub Issues', delay: 100 },
        { html: '  <span class="t-yellow">#142</span>  Add WebSocket support       <span class="t-muted">priority:</span> <span class="t-red">high</span>', delay: 100 },
        { html: '  <span class="t-yellow">#138</span>  Fix memory leak in parser   <span class="t-muted">priority:</span> <span class="t-red">high</span>', delay: 100 },
        { html: '  <span class="t-yellow">#145</span>  Update API documentation    <span class="t-muted">priority:</span> <span class="t-yellow">medium</span>', delay: 100 }
      ]},
      { type: 'wait', delay: 500 },
      { type: 'line', html: '<span class="t-green">&gt;</span> <span class="t-white">Selected #142: Add WebSocket support</span>', delay: 0 },
      { type: 'wait', delay: 600 },
      { type: 'lines', lines: [
        { html: '<span class="t-purple">[explore]</span>    Analyzing 847 files, 12 entry points...', delay: 400 },
        { html: '<span class="t-purple">[plan]</span>       3-phase implementation designed', delay: 400 },
        { html: '<span class="t-purple">[implement]</span>  Writing code across 6 files...', delay: 400 },
        { html: '<span class="t-purple">[review]</span>     4 agents reviewing... 2 issues found, fixing...', delay: 400 }
      ]},
      { type: 'wait', delay: 600 },
      { type: 'line', html: '<span class="t-green">[ship]</span>       PR #143 created <span class="t-green">-&gt;</span> CI passing <span class="t-green">-&gt;</span> merged', delay: 0 },
      { type: 'wait', delay: 800 },
      { type: 'line', html: '', delay: 0 },
      { type: 'line', html: '<span class="t-white t-bold">Done.</span> Task to merged PR in 12 minutes.', delay: 0 },
      { type: 'lines', lines: [
        { html: '  <span class="t-muted">6 files changed, 847 additions, 23 deletions</span>', delay: 100 },
        { html: '  <span class="t-muted">All 4 reviewers approved.</span> <span class="t-purple t-bold">Zero manual intervention.</span>', delay: 100 }
      ]},
      { type: 'wait', delay: 3000 }
    ];

    function clearTerminal() {
      body.innerHTML = '';
    }

    function addLine(html) {
      var div = document.createElement('div');
      div.className = 'terminal__line';
      div.innerHTML = html;
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
    }

    function typeText(text, callback) {
      var line = document.createElement('div');
      line.className = 'terminal__line';
      body.appendChild(line);

      var charIndex = 0;

      function typeChar() {
        if (isPaused) {
          animationTimeout = setTimeout(typeChar, 100);
          return;
        }
        if (charIndex < text.length) {
          // Render as prompt + typed text
          var typed = text.substring(2, charIndex + 1);
          var remaining = charIndex + 1 >= text.length ? '' : '<span class="terminal__cursor"></span>';
          if (charIndex < 2) {
            line.innerHTML = '<span class="t-muted">' + text.substring(0, charIndex + 1) + '</span>' + remaining;
          } else {
            line.innerHTML = '<span class="t-muted">$ </span><span class="t-white">' + typed + '</span>' + remaining;
          }
          charIndex++;
          animationTimeout = setTimeout(typeChar, 80);
        } else {
          // Remove cursor, show final
          line.innerHTML = '<span class="t-muted">$ </span><span class="t-white">' + text.substring(2) + '</span>';
          if (callback) callback();
        }
      }

      typeChar();
    }

    function runSequence(index) {
      if (index >= sequence.length) {
        // Loop: clear and restart
        clearTimeout(animationTimeout);
        animationTimeout = setTimeout(function () {
          clearTerminal();
          runSequence(0);
        }, 500);
        return;
      }

      var step = sequence[index];

      if (isPaused) {
        animationTimeout = setTimeout(function () { runSequence(index); }, 100);
        return;
      }

      switch (step.type) {
        case 'type':
          typeText(step.text, function () {
            runSequence(index + 1);
          });
          break;

        case 'wait':
          animationTimeout = setTimeout(function () {
            runSequence(index + 1);
          }, step.delay);
          break;

        case 'line':
          addLine(step.html);
          animationTimeout = setTimeout(function () {
            runSequence(index + 1);
          }, 100);
          break;

        case 'lines':
          var lines = step.lines;
          var lineIndex = 0;

          function addNextLine() {
            if (isPaused) {
              animationTimeout = setTimeout(addNextLine, 100);
              return;
            }
            if (lineIndex < lines.length) {
              addLine(lines[lineIndex].html);
              lineIndex++;
              animationTimeout = setTimeout(addNextLine, lines[lineIndex - 1].delay);
            } else {
              runSequence(index + 1);
            }
          }

          addNextLine();
          break;
      }
    }

    // Static display for reduced motion
    if (prefersReduced) {
      body.innerHTML = [
        '<div class="terminal__line"><span class="t-muted">$ </span><span class="t-white">/next-task</span></div>',
        '<div class="terminal__line"><span class="t-cyan">[discovery]</span> Found 3 tasks from GitHub Issues</div>',
        '<div class="terminal__line">  <span class="t-yellow">#142</span>  Add WebSocket support       <span class="t-muted">priority:</span> <span class="t-red">high</span></div>',
        '<div class="terminal__line"><span class="t-green">&gt;</span> <span class="t-white">Selected #142: Add WebSocket support</span></div>',
        '<div class="terminal__line"><span class="t-purple">[explore]</span>    Analyzing 847 files, 12 entry points...</div>',
        '<div class="terminal__line"><span class="t-purple">[plan]</span>       3-phase implementation designed</div>',
        '<div class="terminal__line"><span class="t-purple">[implement]</span>  Writing code across 6 files...</div>',
        '<div class="terminal__line"><span class="t-purple">[review]</span>     4 agents reviewing... 2 issues found, fixing...</div>',
        '<div class="terminal__line"><span class="t-green">[ship]</span>       PR #143 created <span class="t-green">-&gt;</span> CI passing <span class="t-green">-&gt;</span> merged</div>',
        '<div class="terminal__line"></div>',
        '<div class="terminal__line"><span class="t-white t-bold">Done.</span> Task to merged PR in 12 minutes.</div>',
        '<div class="terminal__line">  <span class="t-muted">6 files changed, 847 additions, 23 deletions</span></div>',
        '<div class="terminal__line">  <span class="t-muted">All 4 reviewers approved.</span> <span class="t-purple t-bold">Zero manual intervention.</span></div>'
      ].join('');
      return;
    }

    // Start animation
    runSequence(0);
  }

  // ========================================================================
  // DYNAMIC HOW IT WORKS
  // ========================================================================

  function initDynamicHowItWorks() {
    var howItWorksData = {
      0: {
        subtitle: 'One approval. Fully autonomous execution.',
        steps: [
          { title: 'Pick a task', desc: 'Select from GitHub Issues, GitLab, or a local task file. The agent explores your codebase and designs a plan.' },
          { title: 'Approve the plan', desc: 'Review the implementation plan. This is the last human interaction. Everything after is automated.' },
          { title: 'Watch it ship', desc: 'Code, review, cleanup, documentation, PR, CI, merge. All handled. You review the result.' }
        ]
      },
      1: {
        subtitle: '155 rules. 10+ AI tools. One command.',
        steps: [
          { title: 'Discover configs', desc: 'Finds all agent configuration files: Skills, Hooks, MCP, Memory, and Plugins across your project.' },
          { title: 'Run 155 rules', desc: 'Validates against 155 rules across 10+ AI tools including Claude Code, Cursor, Copilot, Codex, and more.' },
          { title: 'Fix and report', desc: '57 rules are auto-fixable with --fix flag. Outputs SARIF for GitHub Code Scanning integration.' }
        ]
      },
      2: {
        subtitle: 'Branch to production in one command.',
        steps: [
          { title: 'Commit and push', desc: 'Stages changes, creates a commit with a clear message, and pushes to your branch automatically.' },
          { title: 'Monitor CI', desc: 'Waits for CI to pass, collects comments from 4 auto-reviewers, and fixes every issue found.' },
          { title: 'Merge and deploy', desc: 'Merges the PR, triggers deployment, validates production, and cleans up the branch.' }
        ]
      },
      3: {
        subtitle: 'Three-phase detection. Certainty-graded cleanup.',
        steps: [
          { title: 'Scan for slop', desc: 'Runs regex patterns, multi-pass analyzers, and optional CLI tools across your codebase.' },
          { title: 'Grade findings', desc: 'Each finding gets a certainty level: HIGH (auto-fixable), MEDIUM (needs context), or LOW (needs judgment).' },
          { title: 'Apply fixes', desc: 'Auto-fixes HIGH certainty issues like debug statements, placeholder text, and verbose comments.' }
        ]
      },
      4: {
        subtitle: 'Measure first. Optimize with evidence.',
        steps: [
          { title: 'Establish baseline', desc: 'Records current performance metrics with sequential benchmarks and minimum 60-second run durations.' },
          { title: 'Test hypotheses', desc: 'Generates theories from git history, then runs controlled experiments one change at a time.' },
          { title: 'Deliver evidence', desc: 'Produces evidence-backed recommendations with profiling data, hotspot analysis, and comparisons.' }
        ]
      },
      5: {
        subtitle: 'JavaScript collects. Opus analyzes.',
        steps: [
          { title: 'Collect data', desc: 'JavaScript collectors scan GitHub state, documentation, and codebase without using any LLM tokens.' },
          { title: 'Semantic analysis', desc: 'A single Opus call performs deep semantic matching between plans and actual implementation.' },
          { title: 'Prioritized report', desc: 'Outputs a prioritized list of gaps, drift, and stale items with reconstruction recommendations.' }
        ]
      },
      6: {
        subtitle: 'Specialized agents. Iterative improvement.',
        steps: [
          { title: 'Select agents', desc: 'Detects your project type and selects from 10 specialist agents: security, performance, architecture, and more.' },
          { title: 'Parallel review', desc: 'All selected agents review relevant files simultaneously, producing certainty-graded findings.' },
          { title: 'Iterate to clean', desc: 'Fixes issues, re-reviews, and repeats until zero open findings remain across all agents.' }
        ]
      },
      7: {
        subtitle: 'Seven analyzers. One unified report.',
        steps: [
          { title: 'Detect content', desc: 'Finds all prompts, agents, plugins, docs, hooks, and skills in your project automatically.' },
          { title: 'Run analyzers', desc: 'Seven specialized analyzers run in parallel, each checking for best practices in its domain.' },
          { title: 'Report and fix', desc: 'Certainty-graded report with auto-fix for HIGH issues. Auto-learns false positives over time.' }
        ]
      },
      8: {
        subtitle: 'AST-based. Cached. Always current.',
        steps: [
          { title: 'Parse with AST', desc: 'Uses ast-grep to extract every export, function, class, and import from your codebase.' },
          { title: 'Build the map', desc: 'Creates a cached JSON map of symbols and their relationships stored in the platform state directory.' },
          { title: 'Validate output', desc: 'The map-validator agent checks for obvious errors, missing data, and structural issues.' }
        ]
      },
      9: {
        subtitle: 'Code changed. Docs follow.',
        steps: [
          { title: 'Diff changes', desc: 'Compares your branch against main to find all files that changed since the last documentation update.' },
          { title: 'Find stale docs', desc: 'Searches documentation for references to changed files, outdated versions, and missing CHANGELOG entries.' },
          { title: 'Auto-fix safely', desc: 'Updates version numbers, CHANGELOG entries, and other deterministic fixes. Flags ambiguous issues for review.' }
        ]
      },
      10: {
        subtitle: 'Web to knowledge base. Reusable.',
        steps: [
          { title: 'Search the web', desc: 'Progressive query architecture gathers 10-40 online sources using broad-to-focused funnel approach.' },
          { title: 'Score sources', desc: 'Each source is scored by quality, relevance, and authority. Low-quality sources are filtered out.' },
          { title: 'Create guide', desc: 'Synthesizes a structured learning guide with RAG-optimized index saved for future agent lookups.' }
        ]
      }
    };

    var subtitleEl = document.getElementById('hiw-subtitle');
    var stepsContainer = document.querySelector('.steps');
    if (!subtitleEl || !stepsContainer) return;

    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var currentIndex = 0;
    var isTransitioning = false;
    var pendingIndex = null;

    // Read animation durations from CSS tokens to stay in sync
    var rootStyles = getComputedStyle(document.documentElement);
    var fadeOutDuration = Math.round(parseFloat(rootStyles.getPropertyValue('--duration-normal')) * 1000) || 200;
    var fadeInDuration = Math.round(parseFloat(rootStyles.getPropertyValue('--duration-moderate')) * 1000) || 400;

    // SVG icons cloned from <template> tags in index.html (separates markup from behavior)
    var stepIconTemplates = [
      document.getElementById('tpl-step-icon-0'),
      document.getElementById('tpl-step-icon-1'),
      document.getElementById('tpl-step-icon-2')
    ];
    var connectorTemplate = document.getElementById('tpl-step-connector');

    function buildSteps(container, data) {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      data.steps.forEach(function (step, i) {
        if (i > 0) {
          var connector = document.createElement('div');
          connector.className = 'steps__connector';
          connector.setAttribute('aria-hidden', 'true');
          connector.appendChild(connectorTemplate.content.cloneNode(true));
          container.appendChild(connector);
        }
        var card = document.createElement('div');
        card.className = 'steps__card';

        var num = document.createElement('span');
        num.className = 'steps__number';
        num.textContent = i + 1;
        card.appendChild(num);

        card.appendChild(stepIconTemplates[i].content.cloneNode(true));

        var title = document.createElement('h3');
        title.className = 'steps__card-title';
        title.textContent = step.title;
        card.appendChild(title);

        var desc = document.createElement('p');
        desc.className = 'steps__card-desc';
        desc.textContent = step.desc;
        card.appendChild(desc);

        container.appendChild(card);
      });
    }

    function updateHowItWorks(index) {
      if (index === currentIndex) return;
      if (isTransitioning) {
        pendingIndex = index;
        return;
      }
      var data = howItWorksData[index];
      if (!data) return;

      currentIndex = index;

      if (prefersReduced) {
        subtitleEl.textContent = data.subtitle;
        buildSteps(stepsContainer, data);
        return;
      }

      isTransitioning = true;
      stepsContainer.classList.add('steps--transitioning');

      setTimeout(function () {
        subtitleEl.textContent = data.subtitle;
        buildSteps(stepsContainer, data);
        stepsContainer.classList.remove('steps--transitioning');
        stepsContainer.classList.add('steps--entering');

        setTimeout(function () {
          stepsContainer.classList.remove('steps--entering');
          isTransitioning = false;
          if (pendingIndex !== null) {
            var next = pendingIndex;
            pendingIndex = null;
            updateHowItWorks(next);
          }
        }, fadeInDuration);
      }, fadeOutDuration);
    }

    // Listen to tab-changed custom event (fired by activateTab for both click and keyboard)
    var commandsTablist = document.querySelector('.commands .tabs[role="tablist"]');
    if (commandsTablist) {
      commandsTablist.addEventListener('tab-changed', function (e) {
        updateHowItWorks(e.detail.index);
      });
    }
  }

  // ========================================================================
  // INIT
  // ========================================================================

  document.addEventListener('DOMContentLoaded', function () {
    initScrollAnimations();
    initNavigation();
    initTabs();
    initCounters();
    initCopyButtons();
    initTerminal();
    initVersionFetch();
    initDynamicHowItWorks();
  });

  // ========================================================================
  // VERSION FETCH
  // ========================================================================

  function initVersionFetch() {
    var el = document.getElementById('site-version');
    if (!el) return;
    fetch('version.json')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.version && d.version !== 'dev') {
          el.textContent = 'v' + d.version;
        }
      })
      .catch(function () {});
  }

})();
