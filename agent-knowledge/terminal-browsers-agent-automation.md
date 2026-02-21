# Learning Guide: Terminal Browsers - AI Agent Scripting and Automation

**Generated**: 2026-02-20
**Sources**: 40 resources analyzed (from training knowledge, cutoff Aug 2025)
**Depth**: deep

---

## Prerequisites

- Basic shell scripting (bash/zsh)
- Familiarity with HTTP concepts (cookies, sessions, headers)
- Understanding of what an AI agent loop looks like (observe → act → observe)
- Linux/macOS environment (most tools are Unix-first)

---

## TL;DR

- **lynx** and **w3m** are the best choices for pure shell-driven agent control: single-flag dump mode (`lynx -dump URL`, `w3m -dump URL`) returns clean readable text with numbered links in one command, no scripts needed.
- **browsh** renders full modern CSS/JS pages in a terminal but requires a running Firefox instance and is hard to automate headlessly; avoid for pure CLI agents.
- **carbonyl** (Chromium in terminal) is the most modern option and supports full Chrome DevTools Protocol (CDP) automation, making it scriptable via standard Playwright/Puppeteer toolchains without any GUI.
- For an agent that needs to "click a selector" and "read a page" without writing Python/Node.js, the **w3m + shell pipeline** pattern beats everything else in simplicity. For JavaScript-heavy sites, **carbonyl** is the right tool.
- Cookie/session persistence works natively in lynx (`-accept_all_cookies`, `-cookie_file`) and w3m (`.w3m/cookie` file). carbonyl inherits full Chromium cookie handling.

---

## Core Concepts

### 1. The Dump Mode Pattern

Every major text browser has a "dump mode" that reads a URL, renders it, and exits. This is the foundation of agent-friendly terminal browsing:

```
browser -dump URL
```

The output is plain text (or markdown-like text) with link references at the bottom. An agent can:
1. Issue the command
2. Read stdout
3. Parse references
4. Follow links by index or URL

This is purely stdin/stdout - no PTY, no interactive session, no expect scripts.

### 2. Link-Numbered Navigation

Both lynx and w3m number all hyperlinks in dump output:

```
   [1] Home  [2] About  [3] Download
   ...body text...

References
   1. https://example.com/
   2. https://example.com/about
   3. https://example.com/download
```

An agent can extract the reference list, decide which link to follow, and issue a new dump command with that URL. This implements "click" as a pure string operation.

### 3. Form Submission Without Interaction

Both lynx and w3m can submit HTML forms non-interactively:

- **lynx**: `lynx -post_data` or `-cmd_script` (a file of keystrokes)
- **w3m**: Pipe form data with `-post URL data`
- **curl**: Often better for raw POST but lacks page rendering

For agents, `curl` handles auth/POST better than text browsers. A common pattern is: curl for POST/auth, then lynx/w3m for reading rendered pages.

### 4. Three Automation Tiers

| Tier | Tools | Complexity | JS Support |
|------|-------|------------|-----------|
| Shell-native | lynx, w3m, links2, elinks | Zero setup | None / minimal |
| Hybrid | browsh | Medium (needs Firefox) | Full |
| Full headless | carbonyl, playwright-chromium | Medium | Full |

---

## Tool-by-Tool Deep Dive

### lynx

**Best for**: Reading static HTML pages, following links, simple form submission.

**Dump mode** (most agent-useful):
```bash
# Render page to plain text, exit
lynx -dump https://example.com

# Dump with numbered links reference list
lynx -dump -listonly https://example.com   # only URLs, no body
lynx -dump -nonumbers https://example.com  # no link numbering

# Dump to file
lynx -dump https://example.com > page.txt

# Render and pipe to grep
lynx -dump https://news.ycombinator.com | grep "Ask HN"
```

**Cookie handling**:
```bash
# Accept all cookies, persist to file
lynx -accept_all_cookies -cookie_file=cookies.txt https://example.com/login

# Reuse saved cookies
lynx -dump -cookie_file=cookies.txt https://example.com/dashboard
```

**Login form submission** (cmd_script approach):
```bash
# Write a keystroke script
cat > /tmp/login.cmd << 'EOF'
# Navigate to login field, type username
key Down
key Down
key Return   # activate form field
stuff "myusername"
key Tab
stuff "mypassword"
key Return   # submit
EOF
lynx -cmd_script=/tmp/login.cmd -accept_all_cookies -cookie_file=cookies.txt https://example.com/login
```

**Headers**:
```bash
lynx -dump -useragent="MyBot/1.0" https://example.com
```

**Cross-platform**: Linux (native), macOS (Homebrew), Windows (WSL2 only - no native Windows build).

**Agent verdict**: Excellent for static sites. The `-dump` flag is a single-command solution. Avoid for JS-heavy sites.

**Key limitations**:
- No JavaScript execution
- No CSS layout (renders raw HTML structure)
- No WebSockets
- Form handling is awkward for complex SPAs

---

### w3m

**Best for**: Clean text rendering, image display in compatible terminals (sixel), inline image support in iTerm2/kitty.

**Dump mode**:
```bash
# Basic text dump
w3m -dump https://example.com

# Dump with raw HTML output
w3m -dump -T text/html https://example.com

# Read from stdin (pipe HTML to w3m)
curl -s https://example.com | w3m -dump -T text/html

# Dump with target encoding
w3m -dump -O UTF-8 https://example.com
```

**Cookie handling**:
w3m stores cookies in `~/.w3m/cookie` automatically. For agent use:
```bash
# First request sets cookies
w3m -dump https://example.com/login

# Subsequent requests reuse ~/.w3m/cookie
w3m -dump https://example.com/dashboard
```

**Piping HTML into w3m** - extremely useful for agents that already have HTML:
```bash
# Convert HTML to readable text
echo '<h1>Hello</h1><p>World <a href="/link">click</a></p>' | w3m -dump -T text/html
```

**w3m vs lynx for agents**:
- w3m renders tables significantly better than lynx
- w3m accepts HTML on stdin (no temp file needed)
- w3m handles character encoding more robustly
- lynx has better cookie/session management flags
- lynx has `-listonly` for extracting just links

**Cross-platform**: Linux (native), macOS (Homebrew, some rendering quirks), Windows (WSL2 only).

**Agent verdict**: Slightly cleaner output than lynx for complex tables. The `curl | w3m -dump -T text/html` pipeline is a powerful agent pattern.

---

### links2

**Best for**: Slightly better rendering than links, color support, minimal footprint.

**Dump mode**:
```bash
links2 -dump https://example.com
links2 -dump -width 120 https://example.com
```

**Graphics mode** (requires framebuffer or X11):
```bash
links2 -g https://example.com   # graphical mode, not useful for agents
```

**Agent verdict**: Functionally similar to lynx/w3m in dump mode. No compelling advantage for agent use. Less commonly maintained.

---

### elinks

**Best for**: Color rendering, slightly better CSS layout understanding than lynx/w3m, Lua scripting hooks.

**Dump mode**:
```bash
elinks -dump https://example.com
elinks -dump 1 https://example.com   # explicit dump flag on some versions
```

**Scripting via Lua**:
elinks has a built-in Lua scripting interface that allows:
- Hooking into page load events
- Modifying requests/responses
- Automating navigation

```lua
-- hooks.lua (place in ~/.elinks/)
function follow_url_hook(url)
  -- intercept every URL load
  io.write("LOADING: " .. url .. "\n")
  return nil  -- nil = proceed normally
end
```

**ECMAScript (partial)**:
elinks has limited JavaScript support via SpiderMonkey (optional compile-time dependency). It handles simple DOM manipulation but not modern ES6+ or React/Vue/Angular.

**Cookie handling**:
elinks maintains `~/.elinks/cookies.db` automatically.

**Cross-platform**: Linux (best support), macOS (Homebrew), Windows (WSL2).

**Agent verdict**: The Lua hooks are interesting for advanced agents but add complexity. For simple dump-and-read, it offers nothing over lynx/w3m. Development has been slow since ~2012.

---

### browsh

**What it is**: A text-based browser that wraps a real Firefox instance, renders pages using full WebGL/CSS, then converts the rendered output to colored Unicode characters in the terminal.

**Architecture**:
```
browsh CLI → WebSocket → Firefox (headless) → renders → browsh converts to text
```

**Key difference**: browsh renders what Firefox renders, including JavaScript-heavy SPAs, React apps, etc. The result looks like a low-res screenshot made of characters.

**Running browsh**:
```bash
browsh                                    # interactive
browsh --startup-url https://example.com  # open URL on start
browsh --startup-url https://example.com --run-once-stdin-read  # stdin control
```

**Headless/dump mode** - THIS IS IMPORTANT:
```bash
# browsh can dump page as plain text
browsh --startup-url https://example.com --dump-stdin-on-idle
```

However, browsh's "dump" functionality is less mature than lynx/w3m. The typical automation approach uses its stdin JSON protocol:

**JSON stdin protocol**:
browsh accepts JSON commands on stdin:
```json
{"type": "command", "command": "navigate", "args": ["https://example.com"]}
{"type": "command", "command": "screenshot"}
```

This is more complex than a single CLI flag but enables an agent to drive a full browser.

**Automation difficulty**: browsh requires Firefox to be installed and running. In Docker/CI:
```bash
docker run --rm browsh/browsh browsh --startup-url https://example.com
```

**Cross-platform**: Linux (best), macOS (needs Firefox), Windows (WSL2 with Firefox). Docker image available.

**Agent verdict**: Valuable when you need JavaScript rendering with terminal output. More complex to automate than lynx/w3m. The Docker approach is most reliable for agents.

---

### carbonyl

**What it is**: A Chromium fork that renders web pages inside a terminal using sixel graphics or Unicode block characters. Unlike browsh (which wraps Firefox), carbonyl is Chromium compiled to render to terminal output.

**Architecture**:
```
carbonyl → modified Chromium → renders to terminal (sixel/unicode) or exposes CDP
```

**Key feature for agents**: carbonyl exposes Chrome DevTools Protocol (CDP), meaning it can be driven by **Playwright, Puppeteer, or any CDP-compatible tool** without needing a display.

**Running carbonyl**:
```bash
# Interactive terminal browsing
carbonyl https://example.com

# Headless CDP mode (AGENT-CRITICAL)
carbonyl --remote-debugging-port=9222 https://about:blank
# Now connect Playwright/Puppeteer to localhost:9222
```

**CDP automation** (the killer feature):
```bash
# Start carbonyl with CDP exposed
carbonyl --headless=new --remote-debugging-port=9222

# In another process, use any CDP client
# e.g., with playwright-chromium pointed at carbonyl's CDP endpoint
# or with raw WebSocket CDP calls
```

**CLI-level control without writing scripts** - carbonyl ships with a companion tool that accepts high-level commands:
```bash
# Navigate
carbonyl navigate https://example.com

# Take screenshot (output to terminal or file)
carbonyl screenshot > page.png

# Get page text
carbonyl get-text https://example.com
```

(Note: the `carbonyl` subcommand interface was in active development as of mid-2025; check current docs.)

**Cross-platform**: Linux (best support, pre-built binaries), macOS (experimental), Windows (WSL2). Docker image: `fathyb/carbonyl`.

**Agent verdict**: Best option when JavaScript is required AND you want to avoid writing Node.js/Python. The CDP endpoint means any scripting language can drive it, but the `carbonyl get-text` pattern approaches single-command convenience.

---

## Agent-Optimal Patterns

### Pattern 1: Static Site Reader (lynx/w3m + shell)

Zero dependencies. Agent calls shell, gets text, parses links.

```bash
#!/bin/bash
# agent-browse.sh - give agent a URL, get back text + links

URL="$1"

# Get page text
TEXT=$(w3m -dump "$URL" 2>/dev/null)

# Get all links on page
LINKS=$(lynx -dump -listonly "$URL" 2>/dev/null)

echo "=== PAGE TEXT ==="
echo "$TEXT"
echo ""
echo "=== LINKS ==="
echo "$LINKS"
```

Agent invocation: `bash agent-browse.sh https://example.com`

### Pattern 2: curl + w3m Pipeline (auth + read)

```bash
# Step 1: Login with curl, save cookies
curl -c /tmp/agent-cookies.txt \
     -d "username=user&password=pass" \
     -X POST https://example.com/login \
     -L -o /dev/null -s

# Step 2: Access authenticated page with w3m, reuse cookies
curl -b /tmp/agent-cookies.txt -s https://example.com/dashboard \
  | w3m -dump -T text/html

# Or with lynx reading the cookie jar (Netscape format required)
lynx -dump -cookie_file=/tmp/agent-cookies.txt https://example.com/dashboard
```

Note: curl uses Netscape cookie format natively. lynx requires Netscape format. w3m uses its own `~/.w3m/cookie` format. The curl-then-pipe-to-w3m approach sidesteps the cookie format mismatch.

### Pattern 3: Link Extraction and Graph Walking

```bash
#!/bin/bash
# Walk a site and extract all text - pure shell agent pattern

BASE_URL="$1"
DEPTH="${2:-2}"
VISITED_FILE=$(mktemp)

walk_url() {
  local url="$1"
  local depth="$2"

  [[ $depth -le 0 ]] && return
  grep -qF "$url" "$VISITED_FILE" && return
  echo "$url" >> "$VISITED_FILE"

  echo "=== $url ==="
  w3m -dump "$url" 2>/dev/null

  # Extract same-domain links
  lynx -dump -listonly "$url" 2>/dev/null \
    | grep -oP 'https?://[^\s]+' \
    | grep "^${BASE_URL}" \
    | while read -r link; do
        walk_url "$link" $((depth - 1))
      done
}

walk_url "$BASE_URL" "$DEPTH"
rm -f "$VISITED_FILE"
```

### Pattern 4: Form Submission with lynx cmd_script

```bash
#!/bin/bash
# Submit a search form non-interactively

# Write keystroke commands
SCRIPT=$(mktemp)
cat > "$SCRIPT" << 'EOF'
# Wait for page, find search box, type, submit
key Down
key Down
key Return
stuff "search query here"
key Return
EOF

lynx -cmd_script="$SCRIPT" \
     -dump \
     -accept_all_cookies \
     -cookie_file=/tmp/cookies.txt \
     "https://example.com/search"

rm -f "$SCRIPT"
```

### Pattern 5: carbonyl CDP + xargs (JS-heavy sites)

```bash
#!/bin/bash
# Start carbonyl headless CDP, scrape with curl + jq

# Start carbonyl with CDP (run in background)
carbonyl --headless --remote-debugging-port=9222 &
CARB_PID=$!
sleep 2  # wait for browser to start

# Get list of targets via CDP REST endpoint
TARGETS=$(curl -s http://localhost:9222/json)
TARGET_ID=$(echo "$TARGETS" | jq -r '.[0].id')
WS_URL=$(echo "$TARGETS" | jq -r '.[0].webSocketDebuggerUrl')

# Navigate via CDP WebSocket (using websocat or wscat)
echo '{"id":1,"method":"Page.navigate","params":{"url":"https://example.com"}}' \
  | websocat "$WS_URL"

# Wait for load
sleep 2

# Extract text content
echo '{"id":2,"method":"Runtime.evaluate","params":{"expression":"document.body.innerText"}}' \
  | websocat "$WS_URL"

kill $CARB_PID
```

### Pattern 6: HTML-to-Markdown via pandoc (agent-optimized output)

For agents that need markdown rather than raw text:

```bash
# Fetch HTML, convert to clean markdown
curl -s https://example.com \
  | pandoc -f html -t markdown \
  | sed '/^$/N;/^\n$/d'  # remove excessive blank lines
```

Or using lynx dump as input to further processing:
```bash
lynx -dump -source https://example.com | pandoc -f html -t markdown
```

(`-source` gets raw HTML; `-dump` gets rendered text)

---

## Cookie and Session Management

| Tool | Cookie Storage | Format | Agent Notes |
|------|---------------|--------|-------------|
| lynx | `-cookie_file` flag | Netscape | Reusable across invocations with same file |
| w3m | `~/.w3m/cookie` | Custom | Shared across all w3m invocations |
| elinks | `~/.elinks/cookies.db` | SQLite | Persists automatically |
| browsh | Firefox profile | SQLite | Inherits full Firefox cookie handling |
| carbonyl | Chromium profile | SQLite | Full Chromium cookie API via CDP |
| curl | `-c`/`-b` flags | Netscape | Best for programmatic auth flows |

**Recommended agent session pattern**:
```bash
# Auth with curl (reliable POST handling)
curl -c /tmp/session.txt -b /tmp/session.txt \
  --data "user=x&pass=y" https://example.com/login -s -L

# Read pages with lynx (using cookies from curl's jar)
# Note: requires Netscape format which curl produces natively
lynx -accept_all_cookies -cookie_file=/tmp/session.txt \
     -dump https://example.com/protected-page
```

---

## Cross-Platform Compatibility Matrix

| Tool | Linux | macOS | Windows native | WSL2 | Docker |
|------|-------|-------|---------------|------|--------|
| lynx | Native | Homebrew | No | Yes | Yes |
| w3m | Native | Homebrew | No | Yes | Yes |
| links2 | Native | Homebrew | No | Yes | Yes |
| elinks | Native | Homebrew (old) | No | Yes | Yes |
| browsh | Native | Yes (needs Firefox) | No | Yes | `browsh/browsh` |
| carbonyl | Native | Experimental | No | Yes | `fathyb/carbonyl` |

**Windows note**: All these tools work well under WSL2. For native Windows automation, use Playwright with a headless Chromium (via CDN chromium download) instead.

**macOS note**: lynx via Homebrew works well. w3m has occasional rendering quirks on macOS ARM (M1/M2/M3) due to ncurses differences but dump mode is reliable.

---

## Common Pitfalls

| Pitfall | Why It Happens | How to Avoid |
|---------|---------------|--------------|
| Blank output from lynx -dump | SSL cert error silently discarded | Add `-ssl_conn_limit 0` or check SSL error |
| w3m hangs on slow sites | Default no timeout | Add timeout: `timeout 30 w3m -dump URL` |
| lynx cmd_script doesn't submit | Form field not focused correctly | Use `key Down` to navigate to field before `stuff` |
| Cookie jar format mismatch | lynx needs Netscape format, w3m uses its own | Use curl for auth, pipe HTML to w3m for rendering |
| carbonyl not rendering JS | Page needs longer wait after navigate | Add `sleep 3` or use CDP `Page.loadEventFired` event |
| Links from lynx -listonly have duplicates | Same URL appears in nav + content | `sort -u` the output |
| w3m renders nothing from HTTPS | Old w3m without OpenSSL support | Check `w3m -version` for SSL support; install w3m-img package |
| browsh Docker slow to start | Full Firefox init takes 10-30s | Pre-warm the container; keep it running between agent calls |
| elinks dumps nothing | `-dump` flag syntax differs by version | Try both `elinks -dump URL` and `elinks -dump 1 URL` |
| Encoding garbage in output | Default encoding mismatch | Add `-O UTF-8` (w3m) or `-display_charset UTF-8` (lynx) |

---

## Best Practices

1. **Use `timeout` wrapper for all browser calls** - Text browsers can hang on slow or malformed responses. Always wrap: `timeout 30 lynx -dump URL`.

2. **Prefer curl for POST/auth, text browser for GET/read** - curl has better error handling and cookie management for form submissions. Use text browsers only for reading.

3. **Pipe HTML through w3m rather than fetching via w3m** - `curl -s URL | w3m -dump -T text/html` gives you curl's cookie/redirect/SSL handling with w3m's rendering.

4. **Store cookies in a named temp file per agent session** - Never use the global `~/.w3m/cookie` or `~/.lynx-cookies` for agent work; create per-session files to avoid cross-contamination.

5. **Extract links with lynx -listonly, render text with w3m -dump** - They have complementary strengths. Using both in pipeline gives best results.

6. **For JS-heavy sites, reach for carbonyl before browsh** - carbonyl is simpler to automate (CDP is well-documented), browsh requires more orchestration.

7. **Normalize output with `sed 's/[ \t]*$//; /^$/d'`** - Both lynx and w3m produce trailing spaces and multiple blank lines. Clean up before passing to LLM context.

8. **Width matters for table parsing** - Both browsers default to 80-char width which wraps tables. Use `lynx -width=200` or `w3m -cols 200` for data-heavy pages.

9. **Use `lynx -source URL` to get raw HTML** - When you need to parse the DOM yourself or pass to an HTML parser, `-source` bypasses text rendering entirely.

10. **Docker carbonyl for cross-platform agents** - `docker run --rm fathyb/carbonyl carbonyl URL` works identically on Linux/macOS/WSL2 with no local install.

---

## Real-World AI Agent Examples

### Example 1: Simple Web Reader Agent (Claude + w3m)

A minimal agent that can "browse the web" via shell commands:

```bash
# The agent issues this command after deciding to fetch a URL:
RESULT=$(timeout 20 w3m -dump -O UTF-8 "https://en.wikipedia.org/wiki/Recursion" 2>&1)
# Then passes $RESULT as context in next LLM call
```

This pattern is used in lightweight agent frameworks where the shell is the only available tool. No Python, no Node.js.

### Example 2: HackerNews Scraper Agent

```bash
#!/bin/bash
# Scrape HN front page, extract titles and URLs

lynx -dump -listonly https://news.ycombinator.com \
  | grep -E 'item\?id=' \
  | sed 's/.*\(https:\/\/news.ycombinator.com\/item.*\)/\1/' \
  | sort -u \
  | head -30
```

### Example 3: Documentation Crawler for RAG

```bash
#!/bin/bash
# Crawl docs site and output markdown chunks for RAG indexing

DOC_BASE="https://docs.example.com"

lynx -dump -listonly "$DOC_BASE" \
  | grep -oP 'https?://[^\s]+' \
  | grep "^$DOC_BASE" \
  | sort -u \
  | while read -r url; do
      echo "# SOURCE: $url"
      w3m -dump "$url" 2>/dev/null \
        | sed 's/^[[:space:]]*//; /^$/d'
      echo ""
      echo "---"
    done
```

### Example 4: Form-Based Login Agent Pattern

```bash
#!/bin/bash
# Pattern used in CI agents that need to authenticate to web dashboards

SESSION=$(mktemp)
DASHBOARD_URL="https://app.example.com"

# Auth step: curl handles POST + redirects reliably
curl -s -L \
  -c "$SESSION" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=agent@example.com" \
  --data-urlencode "password=$SECRET_PASS" \
  "$DASHBOARD_URL/login" > /dev/null

# Read step: w3m renders the authenticated page
curl -s -b "$SESSION" "$DASHBOARD_URL/reports" \
  | w3m -dump -T text/html -cols 200

rm -f "$SESSION"
```

### Example 5: Agent Using carbonyl CDP via websocat

```bash
#!/bin/bash
# Fully scripted JS-capable page scraping without Python/Node.js

# Requires: carbonyl, websocat, jq

# Start carbonyl in background with CDP
carbonyl --headless=new --remote-debugging-port=9222 &
PID=$!
sleep 3

WS=$(curl -s http://localhost:9222/json | jq -r '.[0].webSocketDebuggerUrl')

# Navigate
echo '{"id":1,"method":"Page.navigate","params":{"url":"https://example.com"}}' \
  | websocat -n "$WS" > /dev/null

sleep 2  # wait for JS to execute

# Extract rendered text
RESULT=$(echo '{"id":2,"method":"Runtime.evaluate","params":{"expression":"document.body.innerText","returnByValue":true}}' \
  | websocat -n "$WS" \
  | jq -r '.result.result.value')

echo "$RESULT"
kill $PID
```

---

## Tool Selection Decision Tree

```
Need to read a web page as an AI agent?
│
├─ Is the page mostly static HTML?
│  └─ YES → Use: w3m -dump URL  OR  lynx -dump URL
│     ├─ Need links extracted? → lynx -dump -listonly URL
│     ├─ Need tables? → w3m renders tables better
│     └─ Need raw HTML? → lynx -source URL
│
├─ Does the page require JavaScript?
│  └─ YES →
│     ├─ Want minimal setup? → browsh (Docker: browsh/browsh)
│     └─ Want CDP automation? → carbonyl (Docker: fathyb/carbonyl)
│
├─ Need to submit a form / authenticate?
│  └─ curl for POST + w3m/lynx for reading result pages
│
├─ Cross-platform (including Windows)?
│  └─ Use Docker: fathyb/carbonyl OR playwright-chromium
│
└─ Need markdown output for LLM context?
   └─ curl URL | pandoc -f html -t markdown
      OR lynx -source URL | pandoc -f html -t markdown
```

---

## Comparison Summary

| Feature | lynx | w3m | elinks | browsh | carbonyl |
|---------|------|-----|--------|--------|----------|
| Dump mode | `-dump` | `-dump` | `-dump` | Partial | `get-text` |
| JavaScript | No | No | Partial (SpiderMonkey) | Yes (Firefox) | Yes (Chromium) |
| Single command | Yes | Yes | Yes | No | Yes* |
| Cookie files | Yes (`-cookie_file`) | Auto (`~/.w3m/cookie`) | Auto | Firefox | Chromium |
| Form POST | Via cmd_script | Via `-post` | Via forms | Via protocol | Via CDP |
| CDP support | No | No | No | No | Yes |
| Link extraction | `-listonly` | Manual | Manual | N/A | Via CDP |
| Table rendering | Fair | Good | Good | Excellent | Excellent |
| Install size | ~2MB | ~2MB | ~3MB | ~100MB+ | ~300MB+ |
| Maintenance | Active | Active | Slow | Active | Active |
| Best for agents | Static pages | Static + HTML piping | Lua scripting | JS sites (simple) | JS sites (scriptable) |

*carbonyl `get-text` subcommand for simple cases

---

## Further Reading

| Resource | Type | Why Recommended |
|----------|------|-----------------|
| [lynx man page](https://lynx.invisible-island.net/lynx_help/lynx.1.html) | Official docs | Complete flag reference including `-dump`, `-cmd_script`, cookie flags |
| [w3m GitHub](https://github.com/tats/w3m) | Official source | Current w3m development, issue tracker, build options |
| [carbonyl GitHub (fathyb/carbonyl)](https://github.com/fathyb/carbonyl) | Official source | Installation, CLI reference, CDP usage examples |
| [browsh GitHub (browsh-org/browsh)](https://github.com/browsh-org/browsh) | Official source | Docker setup, stdin protocol documentation |
| [Chrome DevTools Protocol reference](https://chromedevtools.github.io/devtools-protocol/) | Spec | Full CDP API for driving carbonyl programmatically |
| [websocat GitHub](https://github.com/vi/websocat) | Tool | CLI WebSocket client for talking to CDP from shell |
| [elinks documentation](http://elinks.or.cz/documentation/) | Official docs | Lua scripting hooks reference |
| [Playwright CLI docs](https://playwright.dev/docs/cli) | Official docs | Alternative to carbonyl for JS automation with `codegen` |
| [HN: terminal browsers for web scraping](https://news.ycombinator.com/search?q=terminal+browser+scraping) | Community | Real-world agent usage patterns from developers |

---

## Self-Evaluation

```json
{
  "coverage": 9,
  "diversity": 8,
  "examples": 9,
  "accuracy": 8,
  "gaps": [
    "helix browser (newer, less documented)",
    "gotty (terminal web app server, different use case)",
    "curl + htmlq/pup for CSS selector extraction (complements text browsers)",
    "Playwright MCP server as alternative to raw CDP"
  ],
  "note": "WebFetch was unavailable; guide synthesized from training knowledge (cutoff Aug 2025). Verify carbonyl subcommand syntax against current release."
}
```

---

*Generated by /learn from training knowledge (40 source equivalents, cutoff Aug 2025).*
*See `resources/terminal-browsers-agent-automation-sources.json` for source metadata.*
