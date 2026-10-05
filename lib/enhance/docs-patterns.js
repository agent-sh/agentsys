/**
 * Documentation Patterns
 * @author Avi Fenesh
 * @license MIT
 */

function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

/**
 * The destination of a markdown link target, without its title, and with
 * backslash escapes removed: `<a b.md> "T"` gives `a b.md`, `f\(1.md` gives
 * `f(1.md`.
 */
function linkDestination(linkTarget) {
  let target = linkTarget.trim();
  if (target.startsWith('<')) {
    // [text](<path with spaces.md>)
    const end = target.indexOf('>');
    target = end === -1 ? target.slice(1) : target.slice(1, end);
  } else {
    // [text](path "title")
    target = target.split(/\s/)[0];
  }
  // A backslash escapes ASCII punctuation.
  return target.replace(/\\([!-/:-@[-`{-~])/g, '$1');
}

/**
 * The file path in a markdown link target, without its title, anchor or
 * query. Returns null when the target is not a relative path: a URL with a
 * scheme (mailto:, ftp:), a Windows drive path (C:/x.md, which the scheme
 * test also matches), a protocol-relative URL, or a root-relative path,
 * which resolves against a site or repo root this check does not know.
 */
function relativeLinkPath(linkTarget) {
  const target = linkDestination(linkTarget).split('#')[0].split('?')[0];
  if (!target || target.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(target)) {
    return null;
  }
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

const blankOut = text => text.replace(/[^\r\n]/g, ' ');

const LIST_ITEM = /^[ \t]*(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;

/**
 * Blank out code blocks, keeping line breaks.
 *
 * A fence is 3 or more backticks or tildes, indented up to 3 spaces (more
 * inside a list item), and a later line of the same character, at least as
 * long and with nothing after it, closes it. A fence in a blockquote also
 * closes where the quote ends; any other unclosed fence runs to the end, as
 * in CommonMark. Outside a list, a line indented 4 or more spaces after a
 * blank line or another such line is an indented code block.
 */
function stripCodeBlocks(text) {
  const lines = text.split('\n');
  let fence = null;
  let inList = false;
  let prevBlank = true;
  let prevIndentedCode = false;
  for (let i = 0; i < lines.length; i++) {
    // Drop a CRLF file's \r: `.` and `$` below stop short of it.
    const line = lines[i].replace(/\r$/, '');
    if (fence && fence.quoted && !/^[ \t]*>/.test(line)) {
      fence = null;
    }
    if (fence) {
      const close = line.match(/^[ \t>]*(`{3,}|~{3,})[ \t]*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
        fence = null;
      }
      lines[i] = '';
      continue;
    }
    const blank = /^[ \t]*$/.test(line);
    const indent = line.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
    if (!blank && !inList && indent >= 4 && (prevBlank || prevIndentedCode)) {
      lines[i] = '';
      prevBlank = false;
      prevIndentedCode = true;
      continue;
    }
    prevIndentedCode = false;
    const open = line.match(/^((?:[ \t]{0,3}>)*)([ \t]*)(`{3,}|~{3,})(.*)$/);
    // A backtick fence's info string cannot hold a backtick: ```a``` is inline code.
    if (open && (open[2].replace(/\t/g, '    ').length <= 3 || inList) &&
        !(open[3][0] === '`' && open[4].includes('`'))) {
      fence = { char: open[3][0], length: open[3].length, quoted: open[1] !== '' };
      lines[i] = '';
      prevBlank = false;
      continue;
    }
    if (LIST_ITEM.test(line)) {
      inList = true;
    } else if (!blank && indent === 0) {
      inList = false;
    }
    prevBlank = blank;
  }
  return lines.join('\n');
}

/**
 * Split text into plain and inline code parts: [plain, code, plain, ...].
 * A run of N backticks opens a span that the next run of exactly N
 * backticks closes (``a`b`` holds a`b); a run with no closing run is plain
 * text. A backslash escapes a backtick outside code. A span does not cross
 * into another block (see below).
 */
function splitInlineCode(text) {
  const parts = [];
  let last = 0;
  let i = 0;
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2;
      continue;
    }
    if (text[i] !== '`') {
      i++;
      continue;
    }
    let n = 1;
    while (text[i + n] === '`') n++;
    // A span ends with its block: at a blank line, a list item, a heading or
    // a table row. Each run length scans to that point at most once: a later
    // run of the same length before it would have closed this one.
    const runs = /`+|\n[ \t]*\r?\n|\n[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]|\n[ \t]{0,3}(?:#{1,6}[ \t]|\|)/g;
    runs.lastIndex = i + n;
    let end = -1;
    let run;
    while ((run = runs.exec(text)) !== null && run[0][0] === '`') {
      if (run[0].length === n) {
        end = run.index + n;
        break;
      }
    }
    if (end === -1) {
      i += n;
      continue;
    }
    parts.push(text.slice(last, i), text.slice(i, end));
    last = i = end;
  }
  parts.push(text.slice(last));
  return parts;
}

function stripInlineCode(text) {
  return splitInlineCode(text).map((part, i) => (i % 2 === 1 ? blankOut(part) : part)).join('');
}

const MAX_PAREN_NESTING = 32;

/**
 * Index of the `)` that closes a link target whose `(` is at `open`, or -1.
 * Parentheses nest, as in CommonMark: [a](f(1).md) targets f(1).md. A
 * backslash escapes the next character, a <...> target may hold unbalanced
 * parentheses, and a link does not cross a blank line. Like cmark, which
 * GitHub runs, it gives up on a target with more than 32 parentheses nested
 * inside the link's own, so a run of `[a](` costs a few dozen characters per
 * `](` and not the whole 4000-character window.
 */
function linkTargetEnd(text, open) {
  const limit = Math.min(text.length, open + 4000);
  let i = open + 1;
  while (text[i] === ' ' || text[i] === '\t') i++;
  if (text[i] === '<') {
    for (i++; i < limit && text[i] !== '>'; i++) {
      if (text[i] === '\n' || text[i] === '<') return -1;
      if (text[i] === '\\') i++;
    }
    if (text[i] !== '>') return -1;
    i++;
  }
  let depth = 1;
  for (; i < limit; i++) {
    const c = text[i];
    if (c === '\\') {
      i++;
    } else if (c === '\n') {
      let j = i + 1;
      while (j < limit && (text[j] === ' ' || text[j] === '\t' || text[j] === '\r')) j++;
      if (j >= text.length || text[j] === '\n') return -1;
    } else if (c === '(') {
      // depth counts the link's own parenthesis too.
      if (++depth > MAX_PAREN_NESTING + 1) return -1;
    } else if (c === ')' && --depth === 0) {
      return i;
    }
  }
  return -1;
}

/**
 * Replace each [text](target) and ![alt](src) with its text. The target
 * may nest parentheses, as in links outside headings.
 */
function stripLinkSyntax(text) {
  const start = /!?\[([^[\]]{0,2000})\]\(/g;
  let out = '';
  let last = 0;
  let match;
  while ((match = start.exec(text)) !== null) {
    const close = linkTargetEnd(text, match.index + match[0].length - 1);
    if (close === -1) continue;
    out += text.slice(last, match.index) + match[1];
    last = start.lastIndex = close + 1;
  }
  return out + text.slice(last);
}

/**
 * Remove each `<!-- ... -->`. An unclosed `<!--` stays text, and scanning
 * stops there: no later comment can close either.
 */
function stripHtmlComments(text) {
  let out = '';
  let last = 0;
  let start;
  while ((start = text.indexOf('<!--', last)) !== -1) {
    const end = text.indexOf('-->', start + 4);
    if (end === -1) break;
    out += text.slice(last, start);
    last = end + 3;
  }
  return out + text.slice(last);
}

const NAMED_ENTITIES = new Map([
  ['nbsp', '\u00a0'], ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"]
]);

/** Decode &nbsp; &amp; &lt; &gt; &quot; &apos; and numeric entities. */
function decodeEntities(text) {
  return text.replace(/&(?:#[xX]([0-9a-fA-F]{1,6})|#([0-9]{1,7})|([a-z]{1,32}));/g, (all, hex, dec, name) => {
    if (name) return NAMED_ENTITIES.get(name) ?? all;
    const code = hex ? parseInt(hex, 16) : parseInt(dec, 10);
    // Past U+10FFFF is no character (cmark gives U+FFFD); fromCodePoint throws.
    return code > 0x10ffff ? '\ufffd' : String.fromCodePoint(code);
  });
}

/**
 * The text GitHub renders for a heading's markdown: no closing #s, links
 * and images reduced to their text, no HTML comments or tags, entities
 * decoded, and no `_` emphasis markers outside code. An intraword _ stays,
 * as in my_func.
 *
 * Each code span is swapped for a placeholder first, so that all of those
 * steps see the whole heading, including a link whose text holds code, and
 * none of them touches code. The spans go back last.
 */
function headingText(raw) {
  // U+E000 and U+E001 bracket a placeholder; a slug drops them anyway.
  let text = raw.replace(/[\ue000\ue001]/g, '').trim();
  let end = text.length;
  while (end > 0 && text[end - 1] === '#') end--;
  if (end < text.length && (end === 0 || text[end - 1] === ' ' || text[end - 1] === '\t')) {
    text = text.slice(0, end).trimEnd();
  }
  const code = [];
  text = splitInlineCode(text)
    .map((part, i) => {
      if (i % 2 === 0) return part;
      code.push(part);
      return `\ue000${code.length - 1}\ue001`;
    })
    .join('');
  text = stripHtmlComments(stripLinkSyntax(text)).replace(/(?<!\\)<(?:[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][\w.:-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?|\/[A-Za-z][A-Za-z0-9-]*\s*)>/g, '');
  text = decodeEntities(text)
    .replace(/(^|[^\p{L}\p{N}_\\])(_{1,3})(?=[^\s_])([^_]*[^\s_\\])\2(?![\p{L}\p{N}_])/gu, '$1$3');
  return text.replace(/\ue000(\d+)\ue001/g, (all, n) => code[n] ?? '');
}

/**
 * The anchors GitHub generates for the headings in `text`, which must have
 * its code blocks removed. GitHub lowercases the heading text, removes every
 * character that is not a letter, mark, digit, `_`, `-` or space, and turns
 * each space into a `-`, so "Research & Testing" gives research--testing.
 * A repeated anchor gets -1, -2 and so on, skipping any already taken.
 */
function headingAnchors(text) {
  const anchors = [];
  const seen = new Map();
  // Markdown ends a line at \n, \r\n or \r only. The m flag would also end it
  // at U+2028 and U+2029, which GitHub treats as text, so match the line ends
  // by hand. ReDoS: the [ \t] run is bounded and the heading cannot cross a
  // line end.
  const headingRegex = /(?:^|[\n\r])#{1,6}[ \t]{1,1000}([^\n\r]+)/g;
  let match;
  while ((match = headingRegex.exec(text)) !== null) {
    const slug = headingText(match[1])
      .toLowerCase()
      .replace(/[^\p{Alphabetic}\p{M}\p{Nd}\p{Pc}\- ]/gu, '')
      .replace(/ /g, '-');
    // A repeat gets the next free -N; github-slugger does the same.
    let anchor = slug;
    while (seen.has(anchor)) {
      const count = seen.get(slug) + 1;
      seen.set(slug, count);
      anchor = `${slug}-${count}`;
    }
    seen.set(anchor, 0);
    anchors.push(anchor);
  }
  return anchors;
}

/**
 * Supports modes: 'ai' (RAG optimized), 'both' (balanced), 'shared' (both)
 */
const docsPatterns = {
  broken_internal_link: {
    id: 'broken_internal_link',
    category: 'link',
    certainty: 'HIGH',
    autoFix: false,
    mode: 'shared',
    description: 'Internal link references non-existent file or anchor',
    check: (content, context = {}) => {
      if (!content || typeof content !== 'string') return null;

      // Code is not prose: fns[i](arg) in a code block is not a link, and
      // a "# comment" line in a code block is not a heading.
      const withoutBlocks = stripCodeBlocks(content);
      const prose = stripInlineCode(withoutBlocks);
      const anchors = new Set(headingAnchors(withoutBlocks));
      // ReDoS: the link text class is bounded; linkTargetEnd scans at most
      // 4000 characters for the closing parenthesis.
      const linkStart = /\[[^[\]]{1,2000}\]\(/g;
      const brokenLinks = [];
      let match;

      while ((match = linkStart.exec(prose)) !== null) {
        const open = match.index + match[0].length - 1;
        const close = linkTargetEnd(prose, open);
        if (close === -1) continue;
        linkStart.lastIndex = close + 1;
        const linkTarget = prose.slice(open + 1, close);

        // Skip external links
        if (linkTarget.startsWith('http://') || linkTarget.startsWith('https://')) {
          continue;
        }

        // Check internal anchor links
        const destination = linkDestination(linkTarget);
        if (destination.startsWith('#')) {
          let anchorId = destination.slice(1);
          try {
            anchorId = decodeURIComponent(anchorId);
          } catch {
            // Not percent-encoded; compare as written.
          }
          if (!anchors.has(anchorId.toLowerCase())) {
            brokenLinks.push(linkTarget);
          }
        }

        // File links need context.linkExists, which the analyzer passes. It
        // resolves a target against the directory of the linking file.
        if (typeof context.linkExists === 'function' && !destination.startsWith('#')) {
          const targetPath = relativeLinkPath(linkTarget);
          if (targetPath !== null && !context.linkExists(targetPath)) {
            brokenLinks.push(linkTarget);
          }
        }
      }

      if (brokenLinks.length > 0) {
        return {
          issue: `Broken internal links: ${brokenLinks.slice(0, 3).join(', ')}${brokenLinks.length > 3 ? '...' : ''}`,
          fix: 'Fix or remove broken links',
          details: brokenLinks
        };
      }
      return null;
    }
  },

  inconsistent_heading_levels: {
    id: 'inconsistent_heading_levels',
    category: 'structure',
    certainty: 'HIGH',
    autoFix: true,
    mode: 'shared',
    description: 'Heading levels skip (e.g., H1 to H3 without H2)',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      const headingRegex = /^(#{1,6})\s+/gm;
      const levels = [];
      let match;

      while ((match = headingRegex.exec(content)) !== null) {
        levels.push(match[1].length);
      }

      // Check for skipped levels
      for (let i = 1; i < levels.length; i++) {
        const jump = levels[i] - levels[i - 1];
        if (jump > 1) {
          return {
            issue: `Heading level jumps from H${levels[i - 1]} to H${levels[i]}`,
            fix: 'Fix heading hierarchy to not skip levels'
          };
        }
      }
      return null;
    }
  },

  missing_code_language: {
    id: 'missing_code_language',
    category: 'code',
    certainty: 'HIGH',
    autoFix: false,
    mode: 'shared',
    description: 'Code block without language specification',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Find all code block starts
      const allCodeBlocks = content.match(/```/g) || [];
      // Count pairs (opening blocks)
      const totalBlocks = Math.floor(allCodeBlocks.length / 2);

      if (totalBlocks === 0) return null;

      // Find code blocks with language (``` followed by non-whitespace)
      const withLangRegex = /```[a-zA-Z][a-zA-Z0-9_-]*/g;
      const withLang = content.match(withLangRegex) || [];

      const withoutLang = totalBlocks - withLang.length;

      if (withoutLang > 0) {
        return {
          issue: `${withoutLang} code block(s) without language specification`,
          fix: 'Add language hint after ``` (e.g., ```javascript)'
        };
      }
      return null;
    }
  },

  section_too_long: {
    id: 'section_too_long',
    category: 'structure',
    certainty: 'MEDIUM',
    autoFix: false,
    mode: 'shared',
    description: 'Section exceeds 1000 tokens (poor for RAG chunking)',
    maxTokens: 1000,
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Split by headings
      const sections = content.split(/^#{1,6}\s+/m);
      const longSections = [];

      for (let i = 1; i < sections.length; i++) {
        const section = sections[i];
        const tokens = estimateTokens(section);
        if (tokens > 1000) {
          // Get section title (first line)
          const title = section.split('\n')[0].trim().slice(0, 50);
          longSections.push({ title, tokens });
        }
      }

      if (longSections.length > 0) {
        return {
          issue: `${longSections.length} section(s) exceed 1000 tokens`,
          fix: 'Break long sections into smaller, focused subsections',
          details: longSections
        };
      }
      return null;
    }
  },

  unnecessary_prose: {
    id: 'unnecessary_prose',
    category: 'efficiency',
    certainty: 'HIGH',
    autoFix: false,
    mode: 'ai',
    description: 'Filler prose that adds no information value',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Patterns that indicate unnecessary prose
      const prosePatterns = [
        /in this (?:document|section|guide)/gi,
        /as you (?:can see|may know|probably know)/gi,
        /it(?:'s| is) (?:important|worth noting) (?:to note |that )?/gi,
        /please note that/gi,
        /the following (?:section|document|guide) (?:will |provides )/gi,
        /let(?:'s| us) (?:take a look|explore|dive into)/gi,
        /we(?:'ll| will) (?:cover|discuss|explore)/gi,
        /this allows you to/gi,
        /you(?:'ll| will) (?:learn|discover|find)/gi,
        /as mentioned (?:earlier|above|before)/gi
      ];

      const found = [];
      for (const pattern of prosePatterns) {
        const matches = content.match(pattern);
        if (matches) {
          found.push(...matches.slice(0, 2));
        }
      }

      if (found.length >= 3) {
        return {
          issue: `Found ${found.length} instances of unnecessary prose`,
          fix: 'Remove filler text - state facts directly',
          details: found.slice(0, 5)
        };
      }
      return null;
    }
  },

  verbose_explanations: {
    id: 'verbose_explanations',
    category: 'efficiency',
    certainty: 'HIGH',
    autoFix: true,
    mode: 'ai',
    description: 'Verbose explanations that could be condensed',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Detect verbose patterns
      const verbosePatterns = [
        { pattern: /\bin order to\b/gi, replacement: 'to' },
        { pattern: /\bfor the purpose of\b/gi, replacement: 'for' },
        { pattern: /\bin the event that\b/gi, replacement: 'if' },
        { pattern: /\bat this point in time\b/gi, replacement: 'now' },
        { pattern: /\bdue to the fact that\b/gi, replacement: 'because' },
        { pattern: /\bhas the ability to\b/gi, replacement: 'can' },
        { pattern: /\bis able to\b/gi, replacement: 'can' },
        { pattern: /\bmake use of\b/gi, replacement: 'use' },
        { pattern: /\ba large number of\b/gi, replacement: 'many' },
        { pattern: /\ba small number of\b/gi, replacement: 'few' },
        { pattern: /\bthe majority of\b/gi, replacement: 'most' },
        { pattern: /\bprior to\b/gi, replacement: 'before' },
        { pattern: /\bsubsequent to\b/gi, replacement: 'after' }
      ];

      const found = [];
      for (const { pattern } of verbosePatterns) {
        const matches = content.match(pattern);
        if (matches) {
          found.push(...matches);
        }
      }

      if (found.length >= 3) {
        return {
          issue: `Found ${found.length} verbose phrases that could be simplified`,
          fix: 'Replace verbose phrases with concise alternatives',
          details: found.slice(0, 5)
        };
      }
      return null;
    }
  },

  suboptimal_chunking: {
    id: 'suboptimal_chunking',
    category: 'rag',
    certainty: 'MEDIUM',
    autoFix: false,
    mode: 'ai',
    description: 'Content structure suboptimal for RAG chunking',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      const issues = [];

      // Check for very few headings in long content
      const tokens = estimateTokens(content);
      const headingCount = (content.match(/^#{1,6}\s+/gm) || []).length;

      if (tokens > 500 && headingCount < Math.floor(tokens / 500)) {
        issues.push('Too few section headings for content length');
      }

      // Check for headings without content
      const sections = content.split(/^#{1,6}\s+/m);
      for (let i = 1; i < sections.length; i++) {
        const sectionContent = sections[i].split(/^#{1,6}\s+/m)[0];
        if (estimateTokens(sectionContent) < 20) {
          issues.push('Some sections have very little content');
          break;
        }
      }

      if (issues.length > 0) {
        return {
          issue: issues.join('; '),
          fix: 'Restructure content with consistent section sizes (200-500 tokens)'
        };
      }
      return null;
    }
  },

  poor_semantic_boundaries: {
    id: 'poor_semantic_boundaries',
    category: 'rag',
    certainty: 'MEDIUM',
    autoFix: false,
    mode: 'ai',
    description: 'Section mixes multiple distinct topics',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Look for transition words that suggest topic changes within sections
      const transitionPatterns = [
        /\n\n(?:additionally|also|furthermore|moreover|on another note|separately)/gi,
        /\n\n(?:however|on the other hand|alternatively|in contrast)/gi,
        /\n\n(?:next|then|finally|lastly|another (?:thing|point|topic))/gi
      ];

      // Split into sections and check each
      const sections = content.split(/^#{1,6}\s+/m);
      let problemSections = 0;

      for (const section of sections) {
        let transitionsInSection = 0;
        for (const pattern of transitionPatterns) {
          const matches = section.match(pattern);
          if (matches) transitionsInSection += matches.length;
        }

        if (transitionsInSection >= 3) {
          problemSections++;
        }
      }

      if (problemSections > 0) {
        return {
          issue: `${problemSections} section(s) may mix multiple topics`,
          fix: 'Split sections so each covers a single, focused topic'
        };
      }
      return null;
    }
  },

  missing_context_anchors: {
    id: 'missing_context_anchors',
    category: 'rag',
    certainty: 'MEDIUM',
    autoFix: false,
    mode: 'ai',
    description: 'Sections lack self-contained context for RAG retrieval',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Check for dangling pronouns at section starts
      const sections = content.split(/^#{1,6}\s+/m);
      const issues = [];

      for (let i = 1; i < sections.length; i++) {
        const section = sections[i];
        const lines = section.split('\n').filter(l => l.trim());

        if (lines.length > 1) {
          // First content line after heading
          const firstLine = lines[1] || '';

          // Check if starts with dangling reference
          if (/^(?:It|This|These|Those|They|The above|As mentioned)\s/i.test(firstLine)) {
            const title = lines[0].slice(0, 30);
            issues.push(title);
          }
        }
      }

      if (issues.length >= 2) {
        return {
          issue: `${issues.length} sections start with context-dependent references`,
          fix: 'Make each section self-contained (avoid "It", "This" without context)',
          details: issues.slice(0, 3)
        };
      }
      return null;
    }
  },

  token_inefficiency_suggestions: {
    id: 'token_inefficiency_suggestions',
    category: 'efficiency',
    certainty: 'LOW',
    autoFix: false,
    mode: 'ai',
    description: 'Suggestions for reducing token usage',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      const suggestions = [];
      const tokens = estimateTokens(content);

      // Check for repeated phrases
      const words = content.toLowerCase().split(/\s+/);
      const phrases = {};
      for (let i = 0; i < words.length - 2; i++) {
        const phrase = words.slice(i, i + 3).join(' ');
        phrases[phrase] = (phrases[phrase] || 0) + 1;
      }

      const repeatedPhrases = Object.entries(phrases)
        .filter(([_, count]) => count >= 4)
        .map(([phrase]) => phrase);

      if (repeatedPhrases.length > 0) {
        suggestions.push(`Repeated phrases could be consolidated: ${repeatedPhrases.slice(0, 2).join(', ')}`);
      }

      // Check for very long lists that could be tables
      const longLists = content.match(/(?:^[-*][ \t]+\S[^\n]*\n){10,}/gm);
      if (longLists) {
        suggestions.push('Long lists (10+ items) might be more efficient as tables');
      }

      // Check token density
      const lineCount = content.split('\n').length;
      if (lineCount > 0 && tokens / lineCount < 3) {
        suggestions.push('Many short lines - consider consolidating');
      }

      if (suggestions.length > 0) {
        return {
          issue: `Token efficiency suggestions (current: ~${tokens} tokens)`,
          fix: suggestions.join('; ')
        };
      }
      return null;
    }
  },

  missing_section_headers: {
    id: 'missing_section_headers',
    category: 'structure',
    certainty: 'MEDIUM',
    autoFix: false,
    mode: 'both',
    description: 'Long content blocks without section headers',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Find paragraphs (content between headings or start/end)
      const parts = content.split(/^#{1,6}\s+/m);
      const longBlocks = [];

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        // First part (before any heading) should have heading line removed
        // Subsequent parts have the heading text as first line, which we keep for token count
        const cleanPart = i === 0 ? part : part.split('\n').slice(1).join('\n');
        const tokens = estimateTokens(cleanPart);

        if (tokens > 500) {
          const preview = cleanPart.trim().split('\n')[0].slice(0, 50);
          longBlocks.push({ tokens, preview });
        }
      }

      if (longBlocks.length > 0) {
        return {
          issue: `${longBlocks.length} content block(s) over 500 tokens without sub-headers`,
          fix: 'Add section headers to break up long content',
          details: longBlocks
        };
      }
      return null;
    }
  },

  poor_context_ordering: {
    id: 'poor_context_ordering',
    category: 'structure',
    certainty: 'MEDIUM',
    autoFix: false,
    mode: 'both',
    description: 'Important information may be buried too deep',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Check if critical keywords appear late in document
      const criticalKeywords = [
        /\b(?:important|critical|must|required|warning|caution|danger)\b/i,
        /\b(?:error|fail|break|crash|security|vulnerability)\b/i
      ];

      const lines = content.split('\n');
      const totalLines = lines.length;
      const lateThreshold = Math.floor(totalLines * 0.7);

      const lateImportantLines = [];

      for (let i = lateThreshold; i < totalLines; i++) {
        for (const pattern of criticalKeywords) {
          if (pattern.test(lines[i])) {
            lateImportantLines.push(lines[i].trim().slice(0, 50));
            break;
          }
        }
      }

      if (lateImportantLines.length >= 3) {
        return {
          issue: 'Critical information appears in the last 30% of document',
          fix: 'Move important warnings/requirements earlier in the document'
        };
      }
      return null;
    }
  },

  readability_with_rag_suggestions: {
    id: 'readability_with_rag_suggestions',
    category: 'balance',
    certainty: 'LOW',
    autoFix: false,
    mode: 'both',
    description: 'Suggestions for balancing readability and RAG optimization',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      const suggestions = [];

      // Check for very short paragraphs (good for RAG, but might hurt readability)
      const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
      const veryShort = paragraphs.filter(p => estimateTokens(p) < 20).length;

      if (veryShort > paragraphs.length * 0.5) {
        suggestions.push('Many very short paragraphs - consider grouping related points');
      }

      // Check for lack of explanatory text (good for AI, bad for humans)
      const hasExamples = /```|<example>|for example|e\.g\./i.test(content);
      const hasExplanation = /because|since|therefore|this means/i.test(content);

      if (hasExamples && !hasExplanation) {
        suggestions.push('Examples present but limited explanation - add context for human readers');
      }

      // Check for dense technical content without summaries
      const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
      const hasSummary = /^##?\s+(?:summary|overview|tldr|key points)/im.test(content);

      if (codeBlocks >= 5 && !hasSummary) {
        suggestions.push('Dense code content - consider adding a summary section');
      }

      if (suggestions.length > 0) {
        return {
          issue: 'Balance suggestions for readability vs RAG optimization',
          fix: suggestions.join('; ')
        };
      }
      return null;
    }
  },

  structure_recommendations: {
    id: 'structure_recommendations',
    category: 'structure',
    certainty: 'LOW',
    autoFix: false,
    mode: 'both',
    description: 'General structure recommendations',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      const recommendations = [];

      // Check for table of contents in long documents
      const tokens = estimateTokens(content);
      const headingCount = (content.match(/^#{1,6}\s+/gm) || []).length;
      const hasToc = /^##?\s+(?:table of contents|contents|toc)/im.test(content) ||
                     /^\s*-\s+\[.+\]\(#/m.test(content);

      if (tokens > 2000 && headingCount >= 5 && !hasToc) {
        recommendations.push('Consider adding a table of contents for navigation');
      }

      // Check for missing introduction
      const firstHeading = content.match(/^#{1,6}\s+(.+)/m);
      const hasIntro = /^##?\s+(?:introduction|overview|about|getting started)/im.test(content);

      if (tokens > 1000 && firstHeading && !hasIntro) {
        recommendations.push('Consider adding an introduction or overview section');
      }

      // Check for consistent formatting
      const bulletStyles = {
        dash: (content.match(/^-\s+/gm) || []).length,
        asterisk: (content.match(/^\*\s+/gm) || []).length
      };

      if (bulletStyles.dash > 0 && bulletStyles.asterisk > 0) {
        recommendations.push('Mixed bullet styles (- and *) - consider using one consistently');
      }

      if (recommendations.length > 0) {
        return {
          issue: 'Structure recommendations',
          fix: recommendations.join('; ')
        };
      }
      return null;
    }
  }
};

function getAllPatterns() {
  return docsPatterns;
}

function getPatternsByMode(mode) {
  const result = {};
  for (const [name, pattern] of Object.entries(docsPatterns)) {
    if (pattern.mode === mode || pattern.mode === 'shared') {
      result[name] = pattern;
    }
  }
  return result;
}

function getPatternsByCertainty(certainty) {
  const result = {};
  for (const [name, pattern] of Object.entries(docsPatterns)) {
    if (pattern.certainty === certainty) {
      result[name] = pattern;
    }
  }
  return result;
}

function getPatternsByCategory(category) {
  const result = {};
  for (const [name, pattern] of Object.entries(docsPatterns)) {
    if (pattern.category === category) {
      result[name] = pattern;
    }
  }
  return result;
}

function getAutoFixablePatterns() {
  const result = {};
  for (const [name, pattern] of Object.entries(docsPatterns)) {
    if (pattern.autoFix) {
      result[name] = pattern;
    }
  }
  return result;
}

module.exports = {
  docsPatterns,
  estimateTokens,
  getAllPatterns,
  getPatternsByMode,
  getPatternsByCertainty,
  getPatternsByCategory,
  getAutoFixablePatterns,
  getPatternsForMode: getPatternsByMode
};
