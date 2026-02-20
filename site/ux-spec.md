# AgentSys Site UX Specification

Version: 1.0
Last updated: 2026-02-08

---

## 1. Site Structure

**Architecture:** Single-page landing. No separate pages, no routing, no docs section for v1.

The entire site is one HTML file with section anchors. All navigation is smooth-scroll to sections within the page. This keeps the build zero-dependency (no static site generator, no framework) and makes the site feel fast and cohesive.

**URL:** `https://agent-sh.github.io/agentsys/`

**File structure:**
```
site/
  index.html            -- Single page
  assets/
    css/
      tokens.css        -- Design tokens and base variables
      main.css          -- All site styles (layout, components, utilities)
    js/
      main.js           -- Animations, terminal demo, interactions
    logo.png            -- Project logo
    favicon.svg         -- SVG favicon (scales to all sizes)
    og-image.html       -- Open Graph preview template
```

---

## 2. Section Order (Landing Page)

Scroll order with rationale for each section. All sections are full-width, alternating between dark and slightly-lighter-dark backgrounds for visual rhythm.

| # | Section | ID | Rationale |
|---|---------|-----|-----------|
| 1 | Navigation | `nav` | Always visible, establishes brand immediately |
| 2 | Hero | `#hero` | Above the fold: title, subtitle, 2 CTAs, terminal animation. Must communicate the value prop in under 3 seconds |
| 3 | Problem Statement | `#problem` | Emotional hook: "AI writes code. That's solved. Everything else isn't." Creates the gap that the product fills |
| 4 | Stats Bar | `#stats` | Social proof through numbers. Bridges problem to solution with concrete scale |
| 5 | Commands Showcase | `#commands` | The core product. Tabbed interface showing all 11 commands. This is where browsers become believers |
| 6 | How It Works | `#how-it-works` | 3-step visualization simplifies the mental model. Reduces perceived complexity |
| 7 | Design Philosophy | `#philosophy` | For the skeptical engineer. Shows this is thought-through, not thrown together |
| 8 | Installation | `#install` | Conversion point. By now they want to try it. Make installation frictionless |
| 9 | Footer | `footer` | Standard links, version number, attribution |

**Section spacing:** 120px padding top/bottom on desktop, 80px on mobile. Consistent rhythm.

---

## 3. Navigation

### Layout
- **Position:** `fixed`, top: 0, z-index: 1000
- **Height:** 60px
- **Background:** `rgba(10, 10, 15, 0.85)` with `backdrop-filter: blur(12px) saturate(180%)`
- **Border bottom:** `1px solid rgba(255, 255, 255, 0.06)`
- **Max content width:** 1280px, centered with auto margins
- **Padding:** 0 24px

### Elements (left to right)
- **Logo area (left):** Project name "AgentSys" in the heading font, 18px, font-weight 600, white. No image logo for v1. Clicking scrolls to `#hero`.
- **Section links (center-right):** "Commands", "How It Works", "Install" -- these are the 3 most actionable sections. Fewer links = less decision fatigue.
  - Font: 14px, font-weight 500, `rgba(255, 255, 255, 0.65)` default
  - Hover: `rgba(255, 255, 255, 1.0)`, transition 0.2s ease
  - Active (in-view section): white, with a 2px bottom border in the primary accent color, offset 4px below text
- **CTA button (far right):** "GitHub" with a star icon (inline SVG, not icon font). Links to repo.
  - Style: ghost button, 1px solid `rgba(255, 255, 255, 0.2)`, 8px 16px padding, border-radius 6px
  - Hover: background `rgba(255, 255, 255, 0.08)`, border `rgba(255, 255, 255, 0.35)`, transition 0.2s ease

### Scroll Behavior
- **Active section detection:** `IntersectionObserver` on each section, threshold 0.3
- **Background opacity ramp:** Nav starts fully transparent at top of page. Transitions to full background at 100px scroll via `scroll` event listener with `requestAnimationFrame`.

### Mobile (below 768px)
- **Hamburger icon (right):** 3 horizontal lines, 20px wide, 2px thick, 5px gap. CSS-only animation to X on open.
- **Menu:** Slide-in from right, `transform: translateX(100%)` to `translateX(0)`, 0.3s `cubic-bezier(0.4, 0, 0.2, 1)`.
  - Full-height overlay, same dark background as nav
  - Section links stacked vertically, 20px font, 56px tap target height
  - Close on link click (smooth scroll + close menu simultaneously)
  - Focus trapped within menu while open (first focusable to last, tab wrapping)
- **No CTA button in mobile nav** -- save space, the GitHub link appears in mobile menu items instead

---

## 4. Hero Section (`#hero`)

### Layout
- **Height:** `min-height: 100vh` (always fills viewport)
- **Content centering:** CSS Grid, `place-items: center`
- **Two-column on desktop (1024px+):** Left column: text content. Right column: terminal animation. Grid `1fr 1fr` with 64px gap.
- **Single column on mobile:** Text above, terminal below. Stack with 48px gap.

### Left Column Content
1. **Badge** (top, above title): Small pill showing version or "11 plugins . 40 agents . 26 skills"
   - Background: `rgba(99, 102, 241, 0.12)`, border: `1px solid rgba(99, 102, 241, 0.25)`, border-radius: 9999px
   - Font: 13px, font-weight 500, primary accent color
   - Padding: 4px 14px

2. **Title:** "A modular runtime and orchestration system for AI agents."
   - Font: 56px on desktop, 36px on mobile, font-weight 700, line-height 1.1
   - Color: white
   - "entire dev workflow" portion highlighted with a subtle gradient text (primary-to-secondary accent via `background-clip: text`)

3. **Subtitle:** "11 plugins, 40 agents, 26 skills. From task selection to merged PR. Works with Claude Code, OpenCode, and Codex CLI."
   - Font: 18px on desktop, 16px on mobile, font-weight 400, line-height 1.6
   - Color: `rgba(255, 255, 255, 0.6)`
   - Max-width: 520px

4. **CTA buttons** (horizontal row, 16px gap):
   - **Primary:** "Get Started" -- links to `#install`
     - Background: primary accent color (from branding spec), border-radius: 8px
     - Font: 15px, font-weight 600, white
     - Padding: 12px 28px
     - Hover: brightness(1.15), translateY(-1px), box-shadow `0 4px 16px rgba(accent, 0.3)`, transition 0.2s ease
   - **Secondary:** "View on GitHub" -- links to repo
     - Ghost style matching nav CTA (border, no fill)
     - Hover: fill `rgba(255, 255, 255, 0.06)`

### Right Column: Terminal Animation
See Section 5 for the terminal demo specification.

### Entry Animations (on page load, not scroll)
- Badge: fade-in, 0.4s ease-out, 0.1s delay
- Title: fade-in + translateY(20px to 0), 0.6s ease-out, 0.2s delay
- Subtitle: fade-in + translateY(20px to 0), 0.6s ease-out, 0.35s delay
- CTAs: fade-in + translateY(10px to 0), 0.5s ease-out, 0.5s delay
- Terminal: fade-in + translateX(30px to 0), 0.7s ease-out, 0.4s delay

---

## 5. Terminal Demo (Hero)

### Container Design
- **Wrapper:** Rounded rectangle, border-radius 12px, `background: #0d1117` (GitHub dark theme), `border: 1px solid rgba(255, 255, 255, 0.08)`
- **Title bar:** 36px height, 3 dots (red #ff5f57, yellow #febc2e, green #28c840) each 12px diameter, 8px gap, left-aligned with 12px padding. Center text: `zsh` in `rgba(255, 255, 255, 0.4)`, 12px font.
- **Content area:** 20px padding, `font-family: 'JetBrains Mono', 'Fira Code', monospace`, 14px, line-height 1.7
- **Min-height:** 320px
- **Box shadow:** `0 24px 48px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.2)` (floating effect)

### Demo Sequence (~15 seconds total)

The demo shows the core `/next-task` workflow in compressed form. Each "step" appears with a typing animation for commands and instant-render for output.

**Step 1** (0.0s - 2.5s): User types command
```
$ /next-task
```
Typing speed: 80ms per character, blinking cursor `|` at 530ms interval.

**Step 2** (2.5s - 4.5s): Task discovery output (appears line-by-line, 100ms between lines)
```
[discovery] Found 3 tasks from GitHub Issues
  #142  Add WebSocket support       priority: high
  #138  Fix memory leak in parser   priority: high
  #145  Update API documentation    priority: medium
```
Colors: `[discovery]` in cyan (#22d3ee). Issue numbers in yellow (#fbbf24). Priority values: high in red (#f87171), medium in yellow (#fbbf24).

**Step 3** (4.5s - 5.5s): Selection
```
> Selected #142: Add WebSocket support
```
Color: `>` in green (#4ade80), rest in white.

**Step 4** (5.5s - 8.5s): Phase progression (each line appears with 400ms delay)
```
[explore]    Analyzing 847 files, 12 entry points...
[plan]       3-phase implementation designed
[implement]  Writing code across 6 files...
[review]     4 agents reviewing... 2 issues found, fixing...
```
Phase labels: each in the primary accent color. Ellipses animate (cycling 1-3 dots).

**Step 5** (8.5s - 11.0s): Ship phase
```
[ship]       PR #143 created -> CI passing -> merged
```
Color: entire line in green (#4ade80). The arrow `->` animates between states with 600ms per state.

**Step 6** (11.0s - 13.0s): Summary
```
Done. Task to merged PR in 12 minutes.
  6 files changed, 847 additions, 23 deletions
  All 4 reviewers approved. Zero manual intervention.
```
"Done." in bold white. Stats in `rgba(255, 255, 255, 0.5)`. "Zero manual intervention." in the primary accent color, bold.

**Step 7** (13.0s - 15.0s): Pause, then loop. 2 second pause, then clear terminal and restart from Step 1. Loop is infinite.

### Interaction
- **Hover:** Pauses the animation. Shows a subtle "Paused" indicator in top-right of terminal.
- **Click:** No action (the terminal is decorative).

---

## 6. Problem Statement Section (`#problem`)

### Layout
- **Max width:** 720px, centered
- **Text alignment:** center

### Content
- **Heading:** "AI models write code. That's not the hard part anymore."
  - Font: 36px desktop, 28px mobile, font-weight 700, white
- **Body:** "The hard part is everything else. Picking what to work on. Managing branches. Reviewing output. Cleaning up AI artifacts. Handling CI. Addressing reviewer comments. Deploying. AgentSys automates all of it."
  - Font: 18px, line-height 1.7, `rgba(255, 255, 255, 0.55)`
  - "AgentSys automates all of it." in white, font-weight 600

### Entry Animation
- Heading: fade-in + translateY(20px to 0), 0.6s ease-out, triggered at 20% intersection threshold
- Body: fade-in + translateY(20px to 0), 0.6s ease-out, 0.15s delay after heading, same trigger

---

## 7. Stats Bar (`#stats`)

### Layout
- **Full-width** with subtle background difference: `rgba(255, 255, 255, 0.02)` lighter than surrounding sections
- **Content:** 4 stats in a horizontal row, evenly distributed (`display: flex; justify-content: space-around`)
- **Top/bottom border:** `1px solid rgba(255, 255, 255, 0.05)`
- **Padding:** 48px vertical

### Stats (left to right)
| Stat | Value | Label |
|------|-------|-------|
| 1 | 11 | Plugins |
| 2 | 40 | Agents |
| 3 | 26 | Skills |
| 4 | 3,357 | Tests Passing |

### Styling
- **Number:** 48px, font-weight 700, white, `font-variant-numeric: tabular-nums` (prevents layout shift during count)
- **Label:** 14px, font-weight 500, `rgba(255, 255, 255, 0.45)`, uppercase, `letter-spacing: 0.05em`
- **Vertical stack:** number on top, label below, 8px gap

### Counter Animation
- **Trigger:** `IntersectionObserver`, threshold 0.5 (stat bar must be half-visible)
- **Animation:** Count from 0 to target value over 1.5 seconds, using `ease-out` easing (fast start, slow finish)
- **Implementation:** `requestAnimationFrame` loop, incrementing displayed value. No external library.
- **Runs once:** Flag prevents re-triggering on subsequent scrolls.

### Responsive (below 640px)
- 2x2 grid instead of 4-column row
- 32px gap between grid cells

---

## 8. Commands Showcase (`#commands`)

### Layout
- **Section heading:** "11 Commands. One Toolkit."
  - Font: 36px desktop, 28px mobile, font-weight 700, white, text-align center
- **Subheading:** "Each works standalone. Together, they automate everything."
  - Font: 16px, `rgba(255, 255, 255, 0.5)`, text-align center, margin-bottom 48px

### Tab Interface
- **Tab bar:** Horizontal scrollable row of command names
  - `overflow-x: auto`, `scrollbar-width: none` (hidden scrollbar), `-webkit-overflow-scrolling: touch`
  - Each tab: padding 10px 18px, font 14px monospace, `rgba(255, 255, 255, 0.5)` default
  - Active tab: white text, bottom border 2px in primary accent color
  - Hover (inactive): `rgba(255, 255, 255, 0.75)`, transition 0.15s ease
  - On mobile: naturally scrollable, slight gradient fade on right edge to indicate scrollability (20px gradient from transparent to section background)

### Tab Order
`/next-task`, `/ship`, `/deslop`, `/perf`, `/drift-detect`, `/audit-project`, `/enhance`, `/repo-map`, `/sync-docs`, `/learn`, `/agnix`

(Most impactful first: the full workflow command, then the shipper, then individual tools)

### Tab Content Panel
For each command, show:
1. **Command name** in monospace, 24px, white, font-weight 600
2. **One-line description** in 16px, `rgba(255, 255, 255, 0.55)`, max 100 characters
3. **Key features** as 3-4 bullet points, 14px, `rgba(255, 255, 255, 0.5)`, with accent-colored bullet markers
4. **Usage example** in a mini code block (dark background `#0d1117`, 13px monospace, border-radius 8px, padding 16px)

### Content for `/next-task` tab (as example, all others follow same structure):
- **Name:** `/next-task`
- **Description:** "Task to merged PR. Full automation."
- **Features:**
  - 12-phase pipeline: discovery through deployment
  - Multi-agent review loop (code, security, perf, tests)
  - Persistent state: resume from any phase
  - Works with GitHub Issues, GitLab, or local task files
- **Usage:**
  ```
  /next-task                # Start new workflow
  /next-task --resume       # Resume interrupted workflow
  ```

### Tab Switching
- **Transition:** Content fades out (opacity 1 to 0, 0.15s ease), swaps, fades in (opacity 0 to 1, 0.15s ease). Total 0.3s.
- **No slide animation** -- fade is faster and less distracting for tabbed content.
- **Keyboard:** Left/right arrow keys cycle tabs when tab bar is focused. Home/End jump to first/last.

### Entry Animation
- Section heading: fade-in + translateY(20px to 0), 0.6s ease-out, at 20% intersection
- Tab bar + content: fade-in + translateY(20px to 0), 0.6s ease-out, 0.2s delay after heading

---

## 9. How It Works (`#how-it-works`)

### Layout
- **Section heading:** "How It Works"
  - Same styling as other section headings (36px, bold, white, centered)
- **Subheading:** "One approval. Fully autonomous execution."
  - 16px, `rgba(255, 255, 255, 0.5)`, centered, margin-bottom 64px

### 3-Step Visualization
Three cards in a horizontal row on desktop, vertical stack on mobile.

| Step | Icon | Title | Description |
|------|------|-------|-------------|
| 1 | Magnifying glass (inline SVG) | "Pick a task" | "Select from GitHub Issues, GitLab, or a local task file. The agent explores your codebase and designs a plan." |
| 2 | Check circle (inline SVG) | "Approve the plan" | "Review the implementation plan. This is the last human interaction. Everything after is automated." |
| 3 | Rocket (inline SVG) | "Watch it ship" | "Code, review, cleanup, documentation, PR, CI, merge. All handled. You review the result." |

### Card Design
- **Width:** Equal distribution, `flex: 1`, min-width 240px
- **Background:** `rgba(255, 255, 255, 0.03)`, `border: 1px solid rgba(255, 255, 255, 0.06)`
- **Border-radius:** 12px
- **Padding:** 32px
- **Gap between cards:** 24px

### Card Content Layout
- **Step number:** 13px, font-weight 600, primary accent color, `display: inline-block`, `background: rgba(accent, 0.1)`, `border-radius: 9999px`, `width: 28px`, `height: 28px`, `text-align: center`, `line-height: 28px`
- **Icon:** 32px, `rgba(255, 255, 255, 0.7)`, margin-top 20px
- **Title:** 20px, font-weight 600, white, margin-top 16px
- **Description:** 15px, line-height 1.6, `rgba(255, 255, 255, 0.5)`, margin-top 8px

### Connecting Line (desktop only, hidden below 768px)
Between cards 1-2 and 2-3: a horizontal dashed line (`border-top: 2px dashed rgba(255, 255, 255, 0.1)`) connecting the step number circles. Positioned absolutely, vertically aligned with the step numbers.

### Card Hover
- `border-color: rgba(255, 255, 255, 0.12)`, `background: rgba(255, 255, 255, 0.05)`, `translateY(-2px)`, `box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2)`
- Transition: 0.25s ease

### Entry Animation
- Cards appear sequentially: card 1 at 0s, card 2 at 0.15s, card 3 at 0.3s
- Each: fade-in + translateY(30px to 0), 0.6s ease-out
- Trigger: `IntersectionObserver`, threshold 0.2 on the section

---

## 10. Design Philosophy (`#philosophy`)

### Layout
- **Section heading:** "Built Different"
  - Same section heading styling
- **Subheading:** "Not another AI wrapper. Engineering-grade workflow automation."
  - 16px, `rgba(255, 255, 255, 0.5)`, centered

### Cards
4 principle cards in a 2x2 grid on desktop, single column on mobile.

| # | Title | Description | Icon hint |
|---|-------|-------------|-----------|
| 1 | "Code does code work. AI does AI work." | "Static analysis, regex, and AST for detection. LLMs only for synthesis and judgment. 77% fewer tokens than multi-agent approaches." | Split circle (code/brain) |
| 2 | "One agent, one job, done well" | "40 specialized agents, each with a narrow scope and clear success criteria. No agent tries to do everything." | Target/crosshair |
| 3 | "Pipeline with gates" | "Each step must pass before the next begins. Can't push before review. Can't merge before CI. Hooks enforce it -- agents cannot skip phases." | Pipeline/funnel |
| 4 | "Validate plan and results, not every step" | "Approve the plan. See the results. The middle is automated. One approval unlocks autonomous execution." | Shield/check |

### Card Design
Same card styling as How It Works section, but arranged in 2x2 grid:
- `display: grid; grid-template-columns: 1fr 1fr; gap: 24px`
- Below 768px: `grid-template-columns: 1fr`

### Card Content
- **Icon:** 24px inline SVG, primary accent color, opacity 0.8
- **Title:** 18px, font-weight 600, white, margin-top 16px
- **Description:** 14px, line-height 1.6, `rgba(255, 255, 255, 0.5)`, margin-top 8px
- **Highlight numbers** (like "77%", "40") in the primary accent color, font-weight 600

### Entry Animation
- Cards stagger: 0s, 0.1s, 0.2s, 0.3s delay
- Each: fade-in + translateY(20px to 0), 0.5s ease-out
- Trigger: `IntersectionObserver`, threshold 0.15

---

## 11. Installation (`#install`)

### Layout
- **Section heading:** "Get Started in 30 Seconds"
  - Same section heading styling
- **Max width:** 640px, centered (code blocks don't need to be wide)

### Platform Tabs
3 tabs: "Claude Code", "npm (All Platforms)", "Manual"

Tab styling matches Commands section tab bar but smaller scale:
- Font: 13px
- Active indicator: same accent bottom border

### Tab Content

**Claude Code tab:**
```bash
/plugin marketplace add agent-sh/agentsys
/plugin install next-task@agentsys
/plugin install ship@agentsys
```

**npm tab:**
```bash
npm install -g agentsys && agentsys
```
Below the code block: "Interactive installer for Claude Code, OpenCode, and Codex CLI." in 14px, `rgba(255, 255, 255, 0.5)`.

**Manual tab:**
```bash
# Clone and install
git clone https://github.com/agent-sh/agentsys.git
cd agentsys
npm install
```

### Code Block Design
- Background: `#0d1117`
- Border: `1px solid rgba(255, 255, 255, 0.06)`
- Border-radius: 8px
- Padding: 20px
- Font: 14px `'JetBrains Mono', 'Fira Code', monospace`
- Line-height: 1.7
- **Copy button:** Top-right corner, 32px square, `rgba(255, 255, 255, 0.3)` clipboard icon. On click: icon changes to checkmark for 2 seconds, tooltip "Copied!" fades in/out.

### Entry Animation
- Heading: fade-in, 0.5s ease-out, at 20% intersection
- Tab content: fade-in + translateY(15px to 0), 0.5s ease-out, 0.15s delay

---

## 12. Footer

### Layout
- **Background:** Slightly darker than page background, `rgba(0, 0, 0, 0.3)`
- **Border top:** `1px solid rgba(255, 255, 255, 0.05)`
- **Padding:** 48px vertical
- **Max content width:** 1280px, centered

### Content (3 columns on desktop, stacked on mobile)

**Column 1 (left):** Brand
- "AgentSys" in 16px, font-weight 600, white
- "Agent runtime & orchestration system" in 14px, `rgba(255, 255, 255, 0.4)`
- "MIT License" in 13px, `rgba(255, 255, 255, 0.3)`

**Column 2 (center):** Links
- "Documentation" -> `./docs/` (GitHub link)
- "GitHub Issues" -> issues page
- "Discussions" -> discussions page
- "npm" -> npm package page
- Each: 14px, `rgba(255, 255, 255, 0.5)`, hover: white, transition 0.15s

**Column 3 (right):** Version + Author
- "v4.1.0" (pull from package.json at build time; for v1 hardcode it)
- "Made by Avi Fenesh" linking to GitHub profile
- Each: 14px, `rgba(255, 255, 255, 0.4)`

### Responsive (below 768px)
- Single column, centered text
- 24px gap between sections

---

## 13. Interaction Design (Cross-Section Patterns)

### Scroll-Triggered Animations
- **Library:** None. Vanilla `IntersectionObserver`.
- **Default pattern:** Elements start with `opacity: 0; transform: translateY(20px)`. When intersection triggers, add class that transitions to `opacity: 1; transform: translateY(0)`.
- **CSS transition:** `opacity 0.6s ease-out, transform 0.6s ease-out`
- **Threshold:** 0.2 (20% visible) unless noted otherwise per section
- **Once flag:** `{ once: true }` on observer -- animations only play once, never replay on scroll-up

### Hover States (Global)
- **Links:** Color transition 0.15s ease, no underline by default, underline on hover for body links
- **Buttons:** `translateY(-1px)` + brightness/shadow change, 0.2s ease
- **Cards:** Border lighten + background lighten + `translateY(-2px)` + shadow, 0.25s ease
- **Code blocks:** No hover state (they're static content)

### Click Behaviors
- **Nav links:** `scrollIntoView({ behavior: 'smooth', block: 'start' })` with 80px offset for fixed nav
- **CTA "Get Started":** Smooth scroll to `#install`
- **CTA "View on GitHub":** `window.open()` in new tab
- **Copy buttons:** `navigator.clipboard.writeText()`, visual feedback (checkmark) for 2s
- **Tab switching:** Immediate content swap with 0.3s fade transition

### Transition Timing Reference
| Element Type | Duration | Easing | Trigger |
|-------------|----------|--------|---------|
| Scroll animations | 0.6s | ease-out | IntersectionObserver |
| Hover (links) | 0.15s | ease | mouseenter/mouseleave |
| Hover (buttons) | 0.2s | ease | mouseenter/mouseleave |
| Hover (cards) | 0.25s | ease | mouseenter/mouseleave |
| Tab content swap | 0.3s | ease (0.15s out + 0.15s in) | click |
| Counter animation | 1.5s | ease-out | IntersectionObserver |
| Terminal typing | 80ms/char | linear | auto-play |
| Nav background | 0.3s | ease | scroll |
| Mobile menu | 0.3s | cubic-bezier(0.4, 0, 0.2, 1) | click |

---

## 14. Responsive Strategy

### Approach
Mobile-first CSS. Base styles target mobile. Media queries add complexity for larger screens.

### Breakpoints
| Breakpoint | Name | What Changes |
|-----------|------|-------------|
| Base (0-639px) | Mobile | Single column. Stacked sections. 16px body font. 36px headings. Hamburger nav. 2x2 stats grid. Vertical how-it-works cards. |
| 640px | Small tablet | Stats bar becomes 4-column. Slightly larger padding (40px sections). |
| 768px | Tablet | Desktop nav (no hamburger). 2-column grid for philosophy cards. Connecting lines appear in how-it-works. Section padding increases to 100px. |
| 1024px | Desktop | Hero becomes 2-column (text + terminal). Full-size terminal demo. 48px headings. Section padding 120px. |
| 1280px | Large desktop | Max-width container kicks in. Content stops growing, remains centered. Generous whitespace. |

### Touch Targets
- **Minimum tap target:** 44px x 44px for all interactive elements
- **Tab bar items:** min-height 44px
- **Mobile menu items:** 56px height
- **CTA buttons:** 48px height on mobile (larger than desktop)
- **Copy buttons:** 44px x 44px

### Typography Scaling
| Element | Mobile | Desktop |
|---------|--------|---------|
| Hero title | 36px | 56px |
| Section headings | 28px | 36px |
| Body text | 16px | 18px |
| Code blocks | 13px | 14px |
| Nav links | 14px | 14px |
| Small text/labels | 13px | 14px |

### Image/Asset Handling
- No raster images in v1 (all inline SVG icons)
- Terminal demo renders in CSS/JS, not an image
- Open Graph image is the only raster asset (loaded only by social platforms, not by visitors)

---

## 15. README Changes

### Badge Addition
Add a website badge to the existing badge row in `README.md`, positioned after the License badge (line 7):

**Current line 7:**
```markdown
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

**New line 8 (insert after):**
```markdown
[![Website](https://img.shields.io/badge/Website-AgentSys-blue?style=flat&logo=github)](https://agent-sh.github.io/agentsys/)
```

This uses:
- shields.io static badge
- Blue color to differentiate from existing badges (npm is green, CI is dynamic, stars is social, license is yellow)
- GitHub logo since it's GitHub Pages
- "AgentSys" label text (no special escaping needed)
- Links directly to the GitHub Pages URL

### No Other README Changes
The README is the reference. The site is the sell. They complement each other. No content should be duplicated or moved.

---

## 16. Accessibility

### Keyboard Navigation
- **Tab order** follows visual order (nav -> hero CTAs -> sections -> footer links)
- **Skip to content link:** First focusable element on page. Visually hidden until focused (`position: absolute; top: -40px` -> `top: 8px` on `:focus`). Links to `#hero` to skip nav.
- **Tab interface:** `role="tablist"`, `role="tab"`, `role="tabpanel"`. Arrow keys navigate tabs. `aria-selected` on active tab. `tabindex="-1"` on inactive tabs, `tabindex="0"` on active.
- **Mobile menu:** `aria-expanded` on hamburger button. Focus trap while open (Tab from last item wraps to first, Shift+Tab from first wraps to last). Escape key closes menu.
- **Focus indicators:** Default browser outline, enhanced with `outline: 2px solid` primary accent color, `outline-offset: 2px`. Never removed (`outline: none` is prohibited).

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
This disables:
- All scroll-triggered animations (elements appear immediately)
- Terminal typing animation (content shown statically)
- Counter animation (numbers shown at final value)
- Nav background transition
- Tab content transitions
- Hover translate effects

### Color Contrast
- **Body text** (`rgba(255, 255, 255, 0.6)` on dark background): Must meet WCAG AA 4.5:1 ratio. Verify with actual branding colors once defined.
- **Muted text** (`rgba(255, 255, 255, 0.45)`): This is decorative/supplementary only. Primary information must not rely solely on this color.
- **Interactive elements:** All links and buttons must have at least 4.5:1 contrast.
- **Focus indicators:** 3:1 contrast against adjacent colors (WCAG 2.2 requirement).

### Semantic HTML
- `<nav>` for navigation
- `<main>` wrapping all content sections
- `<section>` with `aria-labelledby` pointing to each section's heading `<h2>`
- `<footer>` for footer
- Heading hierarchy: single `<h1>` (hero title), `<h2>` for section headings, `<h3>` within sections
- `<code>` and `<pre>` for code blocks
- `<button>` for interactive elements (not `<div onclick>`)

### Screen Reader Considerations
- Terminal animation has `aria-label="Animated demo showing the /next-task workflow"` and `role="img"` (since it's decorative, not interactive)
- Stats counters have `aria-live="polite"` so the final values are announced
- Tab panels have `aria-labelledby` referencing their tab
- Copy buttons have `aria-label="Copy code to clipboard"`
- GitHub CTA in nav has `aria-label="View AgentSys on GitHub"`

---

## 17. Performance Requirements

### Target
- **Lighthouse Performance:** 95+ (100 is the goal)
- **First Contentful Paint:** < 1.0s
- **Largest Contentful Paint:** < 2.0s
- **Total Blocking Time:** < 100ms
- **Cumulative Layout Shift:** < 0.05

### Implementation
- **No frameworks.** Vanilla HTML, CSS, JS.
- **CSS:** Single file, ~15-20KB unminified. No CSS-in-JS, no preprocessor at build time.
- **JS:** Single file, ~10-15KB unminified. No bundler needed.
- **Fonts:** System font stack for body (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`). Single web font for headings and monospace for code. Load via `<link rel="preload">` with `font-display: swap`.
- **Critical CSS:** Inline nav + hero styles in `<style>` tag in `<head>` to avoid FOUC on above-fold content.
- **Lazy initialization:** `IntersectionObserver` setup for below-fold sections deferred to `DOMContentLoaded`. Terminal animation starts on load (it's above-fold).
- **No images** in page content (all SVG inline). The og-image is only loaded by social platforms.

### Minification (for deployment)
- CSS and JS can be minified via simple CLI tools (`csso`, `terser`) in the build step, or left unminified for v1 since the files are small.

---

## 18. Meta Tags and SEO

### Head Content
```html
<title>AgentSys - Agent Runtime &amp; Orchestration System</title>
<meta name="description" content="A modular runtime and orchestration system for AI agents. 12 plugins, 41 agents, 27 skills — structured pipelines for Claude Code, OpenCode, and Codex CLI.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0a0a0f">

<!-- Open Graph -->
<meta property="og:title" content="AgentSys">
<meta property="og:description" content="AI workflow automation. 11 plugins, 40 agents, 26 skills. Task to merged PR.">
<meta property="og:image" content="https://agent-sh.github.io/agentsys/assets/og-image.png">
<meta property="og:url" content="https://agent-sh.github.io/agentsys/">
<meta property="og:type" content="website">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="AgentSys">
<meta name="twitter:description" content="AI workflow automation. 11 plugins, 40 agents, 26 skills.">
<meta name="twitter:image" content="https://agent-sh.github.io/agentsys/assets/og-image.png">
```

---

## 19. Open Questions for Branding Team

The following decisions depend on the branding spec (Task #1):

1. **Primary accent color** -- Used throughout for highlights, active states, CTAs, gradient text
2. **Secondary accent color** -- Used for gradient text endpoint, occasional variation
3. **Heading font** -- Needs to convey technical authority without being cold
4. **Background color exact value** -- Specified as approximately `#0a0a0f` here, may adjust
5. **OG image design** -- Needs branding alignment

All color values marked "primary accent" or "secondary accent" in this spec should be replaced with actual values from the branding spec.
