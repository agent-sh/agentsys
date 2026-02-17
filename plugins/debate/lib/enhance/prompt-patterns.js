/**
 * Prompt Patterns
 * Detection patterns for general prompt engineering best practices
 *
 * @author Avi Fenesh
 * @license MIT
 */

/**
 * Estimate tokens from text (1 token ~ 4 characters)
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

// Pre-compiled regex patterns for performance (avoid compiling in hot paths)
const FENCE_START_REGEX = /^(\s*)```(\w*)\s*$/;
const FENCE_END_REGEX = /^(\s*)```\s*$/;
// Match both good and bad example tags - skip both for code validation
// (good examples may have simplified/pseudo-code, bad examples intentionally show errors)
const EXAMPLE_TAG_REGEX = /<(?:good|bad)[_-]?example>([\s\S]*?)<\/(?:good|bad)[_-]?example>/gi;

// Language detection patterns (pre-compiled for code_language_mismatch)
const LOOKS_LIKE_JSON_START = /^\s*[\[{]/;
const LOOKS_LIKE_JSON_CONTENT = /[:,]/;
const NOT_JSON_KEYWORDS = /(function|const|let|var|if|for|while|class)\b/;
// JS patterns require syntax context (not just keywords that might appear in JSON strings)
const LOOKS_LIKE_JS = /\b(function\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|=>\s*[{(]|async\s+function|await\s+\w|class\s+\w+\s*{|import\s+\{|export\s+(const|function|class|default)|require\s*\()/;
const LOOKS_LIKE_PYTHON = /\b(def\s+\w+|import\s+\w+|from\s+\w+\s+import|class\s+\w+:|if\s[^:\n]*:|\s{4}|print\()\b/;

// Memoization caches for performance (keyed by content hash)
let _lastContent = null;
let _exampleRanges = null;
let _linePositions = null;

/**
 * Extract fenced code blocks from markdown content
 * @param {string} content - Markdown content
 * @returns {Array<{language: string, code: string, startLine: number, endLine: number}>} Array of code blocks
 */
function extractCodeBlocks(content) {
  if (!content || typeof content !== 'string') return [];

  const blocks = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let currentBlock = null;
  let codeLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1; // 1-indexed

    // Check for code fence start (``` with optional language)
    const fenceStartMatch = line.match(FENCE_START_REGEX);
    const fenceEndMatch = line.match(FENCE_END_REGEX);

    if (!inCodeBlock && fenceStartMatch) {
      // Start of code block
      inCodeBlock = true;
      currentBlock = {
        language: fenceStartMatch[2] || '', // Empty string if no language
        startLine: lineNum,
        indent: fenceStartMatch[1] || ''
      };
      codeLines = [];
    } else if (inCodeBlock && fenceEndMatch) {
      // End of code block
      inCodeBlock = false;
      if (currentBlock) {
        blocks.push({
          language: currentBlock.language,
          code: codeLines.join('\n'),
          startLine: currentBlock.startLine,
          endLine: lineNum
        });
        currentBlock = null;
      }
      codeLines = [];
    } else if (inCodeBlock) {
      // Inside code block - collect the code
      codeLines.push(line);
    }
  }

  // Handle unclosed code block at end of file
  if (inCodeBlock && currentBlock) {
    blocks.push({
      language: currentBlock.language,
      code: codeLines.join('\n'),
      startLine: currentBlock.startLine,
      endLine: lines.length
    });
  }

  return blocks;
}

/**
 * Build example ranges cache for a content string (both good and bad examples)
 * @param {string} content - Content to analyze
 * @returns {Array<{start: number, end: number}>} Array of example tag ranges
 */
function buildExampleRanges(content) {
  const ranges = [];
  const regex = new RegExp(EXAMPLE_TAG_REGEX.source, EXAMPLE_TAG_REGEX.flags);
  let match;

  while ((match = regex.exec(content)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length
    });
  }
  return ranges;
}

/**
 * Build line position cache for a content string
 * @param {string} content - Content to analyze
 * @returns {Array<number>} Array of character positions for each line start
 */
function buildLinePositions(content) {
  const positions = [0]; // Line 1 starts at position 0
  let pos = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      positions.push(i + 1);
    }
  }
  return positions;
}

/**
 * Invalidate cache if content changed
 * @param {string} content - Current content
 */
function ensureCache(content) {
  if (content !== _lastContent) {
    _lastContent = content;
    _exampleRanges = buildExampleRanges(content);
    _linePositions = buildLinePositions(content);
  }
}

/**
 * Check if a position is inside an example tag (good or bad) (memoized)
 * @param {string} content - Full content
 * @param {number} position - Character position to check
 * @returns {boolean} True if inside example tags
 */
function isInsideExampleTag(content, position) {
  if (!content || position < 0) return false;

  ensureCache(content);

  for (const range of _exampleRanges) {
    if (position >= range.start && position <= range.end) {
      return true;
    }
  }

  return false;
}

/**
 * Get character position for a line number (memoized)
 * @param {string} content - Content
 * @param {number} lineNumber - 1-indexed line number
 * @returns {number} Character position at start of line
 */
function getPositionForLine(content, lineNumber) {
  if (!content || lineNumber < 1) return 0;

  ensureCache(content);

  const idx = lineNumber - 1;
  if (idx < _linePositions.length) {
    return _linePositions[idx];
  }
  return _linePositions[_linePositions.length - 1] || 0;
}

/**
 * Prompt patterns with certainty levels
 * Focuses on prompt quality (not agent-specific frontmatter/config)
 *
 * Categories:
 * - clarity: Clear, specific instructions
 * - structure: XML tags, sections, organization
 * - examples: Few-shot examples
 * - context: Context and motivation
 * - output: Output format specification
 * - anti-pattern: Common mistakes
 */
const promptPatterns = {
  // ============================================
  // CLARITY PATTERNS (HIGH certainty)
  // ============================================

  /**
   * Vague instructions without specifics
   * HIGH certainty - fuzzy language reduces effectiveness
   */
  vague_instructions: {
    id: 'vague_instructions',
    category: 'clarity',
    certainty: 'HIGH',
    autoFix: false,
    description: 'Instructions use vague language like "usually", "sometimes", "try to"',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Strip lines documenting vague patterns (not actual vague instructions)
      const lines = content.split('\n').filter(line => {
        const trimmed = line.trim().toLowerCase();
        // Skip lines listing vague terms as documentation
        if (/vague\s*(instructions?|terms?|language|patterns?)\s*[:"]/.test(trimmed)) return false;
        // Skip lines with quoted lists of vague words
        if (trimmed.includes('usually') && trimmed.includes('sometimes') && /["']/.test(trimmed)) return false;
        return true;
      });
      const filteredContent = lines.join('\n');

      const vaguePatterns = [
        { pattern: /\busually\b/gi, word: 'usually' },
        { pattern: /\bsometimes\b/gi, word: 'sometimes' },
        { pattern: /\boften\b/gi, word: 'often' },
        { pattern: /\brarely\b/gi, word: 'rarely' },
        { pattern: /\bmaybe\b/gi, word: 'maybe' },
        { pattern: /\bmight\b/gi, word: 'might' },
        { pattern: /\bshould probably\b/gi, word: 'should probably' },
        { pattern: /\btry to\b/gi, word: 'try to' },
        { pattern: /\bas much as possible\b/gi, word: 'as much as possible' },
        { pattern: /\bif possible\b/gi, word: 'if possible' },
        { pattern: /\bwhen appropriate\b/gi, word: 'when appropriate' },
        { pattern: /\bas needed\b/gi, word: 'as needed' }
      ];

      const found = [];
      for (const { pattern, word } of vaguePatterns) {
        const matches = filteredContent.match(pattern);
        if (matches) {
          found.push({ word, count: matches.length });
        }
      }

      const totalCount = found.reduce((sum, f) => sum + f.count, 0);

      if (totalCount >= 4) {
        const examples = found.slice(0, 3).map(f => `"${f.word}" (${f.count}x)`);
        return {
          issue: `Found ${totalCount} vague terms: ${examples.join(', ')}`,
          fix: 'Replace vague language with specific, deterministic instructions'
        };
      }
      return null;
    }
  },

  /**
   * Negative-only constraints without alternatives
   * HIGH certainty - "don't X" less effective than "do Y instead"
   */
  negative_only_constraints: {
    id: 'negative_only_constraints',
    category: 'clarity',
    certainty: 'HIGH',
    autoFix: false,
    description: 'Uses "don\'t", "never", "do not" without stating what TO do',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Strip lines documenting bad patterns (not actual constraints)
      const lines = content.split('\n').filter(line => {
        const trimmed = line.trim().toLowerCase();
        // Skip lines that document anti-patterns
        if (/^-?\s*bad:|^\*\*bad\*\*:|^bad:/.test(trimmed)) return false;
        // Skip lines in "Bad/Good" comparison format
        if (/^-\s*"don't|^-\s*"never/.test(trimmed)) return false;
        return true;
      });
      const filteredContent = lines.join('\n');

      // Find negative constraints
      const negativePatterns = [
        /\bdon['']t\s+\w+/gi,
        /\bnever\s+\w+/gi,
        /\bdo not\s+\w+/gi,
        /\bavoid\s+\w+ing\b/gi,
        /\brefrain from\b/gi
      ];

      const negatives = [];
      for (const pattern of negativePatterns) {
        const matches = filteredContent.match(pattern);
        if (matches) {
          negatives.push(...matches.slice(0, 2));
        }
      }

      // Check if there are positive alternatives nearby
      const positiveIndicators = /\binstead\b|\brather\b|\buse\b.*\binstead\b|\bonly\s+\w+/gi;
      const hasAlternatives = positiveIndicators.test(filteredContent);

      if (negatives.length >= 5 && !hasAlternatives) {
        return {
          issue: `${negatives.length} negative constraints without positive alternatives`,
          fix: 'For each "don\'t X", also state what TO do instead',
          details: negatives.slice(0, 5)
        };
      }
      return null;
    }
  },

  /**
   * Missing explicit output format
   * HIGH certainty - prompts should specify expected output
   */
  missing_output_format: {
    id: 'missing_output_format',
    category: 'output',
    certainty: 'HIGH',
    autoFix: true,
    description: 'No clear output format specification',
    check: (content, filePath) => {
      if (!content || typeof content !== 'string') return null;

      // Skip workflow orchestrators that spawn agents/skills rather than produce output directly
      const lc = content.toLowerCase();
      const isOrchestrator = /##\s*Phase\s+\d+/i.test(content) || content.includes('Task({') ||
        (lc.includes('spawn') && lc.includes('agent')) || content.includes('subagent_type') ||
        content.includes('await Task(') || (lc.includes('invoke') && lc.includes('skill')) ||
        (/\bSkill\b/.test(content) && lc.includes('tool'));
      if (isOrchestrator) return null;

      // Skip reference docs and hooks (not prompts that produce conversational output)
      const isReferenceOrHook = /[/\\](?:references?|hooks?)[/\\]/i.test(filePath || '') ||
                                /^##?\s*(?:reference|knowledge|background)/im.test(content);
      if (isReferenceOrHook) return null;

      // Check for output format indicators
      const outputIndicators = [
        /##\s*output\s*(?:format|templates?|expectations?)/i,
        /##\s*response\s*format/i,
        /##\s*(?:issue|report)\s*format/i,
        /##\s*format/i,
        /##\s*example\s*(?:input\/)?output/i,
        /\brespond\s+(?:with|in)\s+(?:JSON|XML|markdown|YAML)/i,
        /\boutput\s+a\s+(?:comprehensive|detailed|structured)/i,
        /\boutput\s*:\s*```/i,
        /<output_format>/i,
        /<response_format>/i,
        /your\s+(?:response|output)\s+should\s+(?:be|follow)/i,
        /\breturn(?:s|ing)?\s+(?:JSON|structured|formatted)/i
      ];

      for (const pattern of outputIndicators) {
        if (pattern.test(content)) {
          return null;
        }
      }

      // Only flag if prompt is substantial enough to warrant format spec
      const tokens = estimateTokens(content);
      if (tokens > 200) {
        return {
          issue: 'No output format specification found',
          fix: 'Add "## Output Format" section or <output_format> tags specifying expected response structure'
        };
      }
      return null;
    }
  },

  /**
   * Aggressive emphasis (CAPS, excessive emphasis)
   * HIGH certainty - overuse triggers over-indexing
   */
  aggressive_emphasis: {
    id: 'aggressive_emphasis',
    category: 'clarity',
    certainty: 'HIGH',
    autoFix: true,
    description: 'Excessive aggressive emphasis that may cause over-indexing',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Detect specific aggressive patterns (CAPS only, not lowercase)
      const aggressivePatterns = [
        // Intensifiers that add no value (CAPS only)
        { pattern: /\bABSOLUTELY\b/g, word: 'ABSOLUTELY' },
        { pattern: /\bTOTALLY\b/g, word: 'TOTALLY' },
        { pattern: /\bCOMPLETELY\b/g, word: 'COMPLETELY' },
        { pattern: /\bENTIRELY\b/g, word: 'ENTIRELY' },
        { pattern: /\bDEFINITELY\b/g, word: 'DEFINITELY' },
        { pattern: /\bEXTREMELY\b/g, word: 'EXTREMELY' },
        // Aggressive phrases (CAPS only)
        { pattern: /\bEXTREMELY\s+IMPORTANT\b/g, word: 'EXTREMELY IMPORTANT' },
        { pattern: /\bSUPER\s+IMPORTANT\b/g, word: 'SUPER IMPORTANT' },
        { pattern: /\bVERY\s+VERY\b/g, word: 'VERY VERY' },
        // Excessive punctuation
        { pattern: /!{3,}/g, word: '!!!' },
        { pattern: /\?{3,}/g, word: '???' }
      ];

      const found = [];
      for (const { pattern, word } of aggressivePatterns) {
        const matches = content.match(pattern);
        if (matches) {
          found.push({ word, count: matches.length });
        }
      }

      const totalCount = found.reduce((sum, f) => sum + f.count, 0);

      // Only flag if multiple instances (threshold: 3+)
      if (totalCount >= 3) {
        const examples = found.slice(0, 3).map(f => `"${f.word}" (${f.count}x)`);
        return {
          issue: `${totalCount} instances of aggressive emphasis: ${examples.join(', ')}`,
          fix: 'Use normal language - models respond well to clear instructions without shouting',
          details: found.map(f => f.word)
        };
      }
      return null;
    }
  },

  // ============================================
  // STRUCTURE PATTERNS (HIGH/MEDIUM certainty)
  // ============================================

  /**
   * Missing XML structure for complex prompts
   * HIGH certainty - XML helps structure for Claude/GPT
   */
  missing_xml_structure: {
    id: 'missing_xml_structure',
    category: 'structure',
    certainty: 'LOW', // Very advisory - XML is optional enhancement
    autoFix: true,
    description: 'Complex prompt without XML tags for structure',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      const tokens = estimateTokens(content);
      const sectionCount = (content.match(/^#{1,6}\s+/gm) || []).length;
      const hasCodeBlocks = /```/.test(content);

      // Complex prompt indicators
      const isComplex = tokens > 800 || (sectionCount >= 6 && hasCodeBlocks);

      // Check for XML tags
      const hasXML = /<[a-z_][a-z0-9_-]*>/i.test(content);

      if (isComplex && !hasXML) {
        return {
          issue: 'Complex prompt without XML structure tags',
          fix: 'Use XML tags like <role>, <constraints>, <examples>, <output_format> for key sections'
        };
      }
      return null;
    }
  },

  /**
   * Inconsistent section formatting
   * MEDIUM certainty - consistency aids parsing
   */
  inconsistent_sections: {
    id: 'inconsistent_sections',
    category: 'structure',
    certainty: 'LOW', // Style preference, not a real issue
    autoFix: false,
    description: 'Mixed heading styles or inconsistent section patterns',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Check for mixed heading styles
      const h2Count = (content.match(/^##\s+/gm) || []).length;
      const boldHeadingCount = (content.match(/^\*\*[^*]+\*\*\s*$/gm) || []).length;

      if (h2Count >= 2 && boldHeadingCount >= 2) {
        return {
          issue: 'Mixed heading styles (## and **bold**)',
          fix: 'Use consistent heading format throughout the prompt'
        };
      }

      // Note: Heading hierarchy check moved to heading_hierarchy_gaps pattern

      return null;
    }
  },

  /**
   * Critical info buried in middle
   * MEDIUM certainty - lost-in-the-middle effect
   */
  critical_info_buried: {
    id: 'critical_info_buried',
    category: 'structure',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Important instructions buried in middle of prompt',
    check: (content, filePath) => {
      if (!content || typeof content !== 'string') return null;

      const lines = content.split('\n').filter(l => l.trim());
      if (lines.length < 20) return null;

      // Skip skill files with workflow phases (natural structure)
      if (/SKILL\.md$/i.test(filePath || '') &&
          /##?\s*(?:workflow|phase\s*\d)/i.test(content)) {
        return null;
      }

      // Check if file has a dedicated Critical Rules section at the start
      const first30Percent = lines.slice(0, Math.floor(lines.length * 0.3)).join('\n');
      if (/##?\s*(?:critical|important)\s*rules?\b/i.test(first30Percent)) {
        return null; // Has critical rules section at start, structure is intentional
      }

      const middleStart = Math.floor(lines.length * 0.3);
      const middleEnd = Math.floor(lines.length * 0.7);
      const middleSection = lines.slice(middleStart, middleEnd).join('\n');

      // Check for critical keywords in middle (outside code blocks)
      // Code blocks are excluded since they contain example code, not actual instructions
      const middleWithoutCode = middleSection.replace(/```[\s\S]*?```/g, '');

      // Design decision: Removed 'must' and 'required' from detection patterns
      // These words are too common in imperative documentation and cause false positives
      // Keeping 'important', 'critical', 'essential', 'mandatory' as stronger indicators
      const criticalPatterns = [
        /\b(?:important|critical|essential|mandatory)\b/gi,
        /\b(?:always|never)\s+\w+/gi,
        /\b(?:warning|caution)\s*:/gi
      ];

      let criticalInMiddle = 0;
      for (const pattern of criticalPatterns) {
        const matches = middleWithoutCode.match(pattern);
        if (matches) criticalInMiddle += matches.length;
      }

      // Design decision: Threshold of 8 chosen based on analysis
      // Original threshold of 5 flagged too many workflow files with legitimate
      // middle content (phase descriptions, step details). 8 catches files with
      // genuinely dense critical instructions in the middle.
      if (criticalInMiddle >= 8) {
        return {
          issue: `${criticalInMiddle} critical instructions in the middle 40% of prompt`,
          fix: 'Move critical instructions to the beginning or end (lost-in-the-middle effect)'
        };
      }
      return null;
    }
  },

  // ============================================
  // EXAMPLE PATTERNS (HIGH/MEDIUM certainty)
  // ============================================

  /**
   * No examples in complex prompt
   * HIGH certainty - few-shot improves accuracy
   */
  missing_examples: {
    id: 'missing_examples',
    category: 'examples',
    certainty: 'MEDIUM', // Context-dependent - not all prompts need examples
    autoFix: true,
    description: 'Complex prompt without examples (few-shot)',
    check: (content, filePath) => {
      if (!content || typeof content !== 'string') return null;

      const tokens = estimateTokens(content);

      // Skip if prompt is simple
      if (tokens < 300) return null;

      // Skip reference docs, research files, agents, skills, and non-prompt content
      const isNonPrompt = /[/\\](?:references?|docs?|agents?)[/\\]/i.test(filePath || '') ||
                         /(?:RESEARCH|SKILL)\.md$/i.test(filePath || '') ||
                         /^---\s*\nname:/m.test(content) || // Agent frontmatter
                         /\*\*Parent document\*\*:/i.test(content) || // Sub-reference file
                         /^##?\s*(?:reference|research|background|knowledge)/im.test(content);
      if (isNonPrompt) return null;

      // Skip workflow orchestrators and command files
      const lc2 = content.toLowerCase();
      const isOrchestrator = /##\s*Phase\s+\d+/i.test(content) || content.includes('Task({') ||
        (lc2.includes('spawn') && lc2.includes('agent')) || content.includes('subagent_type');
      if (isOrchestrator) return null;

      // Check for example indicators
      const exampleIndicators = [
        /##\s*example/i,
        /<example>/i,
        /<good[_-]?example>/i,
        /<bad[_-]?example>/i,
        /\bfor example\b/i,
        /\be\.g\.\b/i,
        /\bsample\s+(?:input|output|response)/i,
        /input:\s*\n.{1,500}\noutput:/is
      ];

      for (const pattern of exampleIndicators) {
        if (pattern.test(content)) {
          return null;
        }
      }

      // Check if it's asking for specific format
      const needsExamples = /\bformat\b|\bjson\b|\bxml\b|\bstructured\b/i.test(content);

      if (needsExamples) {
        return {
          issue: 'Complex prompt with format requirements but no examples',
          fix: 'Add 2-5 few-shot examples showing expected input/output format'
        };
      }
      return null;
    }
  },

  /**
   * Example count not optimal (2-5 is ideal)
   * MEDIUM certainty - too few or too many examples
   */
  suboptimal_example_count: {
    id: 'suboptimal_example_count',
    category: 'examples',
    certainty: 'LOW', // Advisory - example count is flexible
    autoFix: false,
    description: 'Example count outside optimal 2-5 range',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Count examples
      const exampleSections = (content.match(/##\s*example/gi) || []).length;
      const goodExamples = (content.match(/<good[_-]?example>/gi) || []).length;
      const badExamples = (content.match(/<bad[_-]?example>/gi) || []).length;
      const exampleTags = (content.match(/<example>/gi) || []).length;

      const totalExamples = exampleSections + goodExamples + badExamples + exampleTags;

      if (totalExamples === 0) return null; // Handled by missing_examples

      if (totalExamples === 1) {
        return {
          issue: 'Only 1 example (optimal: 2-5)',
          fix: 'Add at least one more example - single examples may not demonstrate patterns effectively'
        };
      }

      if (totalExamples > 7) {
        return {
          issue: `${totalExamples} examples (optimal: 2-5)`,
          fix: 'Consider reducing examples to avoid token bloat - keep the most representative ones'
        };
      }

      return null;
    }
  },

  /**
   * Examples without clear good/bad distinction
   * MEDIUM certainty - showing both patterns helps
   */
  examples_without_contrast: {
    id: 'examples_without_contrast',
    category: 'examples',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Examples lack good/bad contrast for pattern learning',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Check if has examples
      const hasExamples = /<example>|##\s*example/i.test(content);
      if (!hasExamples) return null;

      // Check for contrast indicators
      const hasGood = /<good[_-]?example>|\bgood example\b|\bcorrect\b/i.test(content);
      const hasBad = /<bad[_-]?example>|\bbad example\b|\bincorrect\b|\bwrong\b/i.test(content);

      // Count total examples
      const exampleCount = (content.match(/<example>|##\s*example/gi) || []).length;

      if (exampleCount >= 3 && !hasGood && !hasBad) {
        return {
          issue: 'Multiple examples without good/bad distinction',
          fix: 'Label examples as good/bad or correct/incorrect to clarify expected patterns'
        };
      }
      return null;
    }
  },

  // ============================================
  // CONTEXT PATTERNS (MEDIUM certainty)
  // ============================================

  /**
   * Missing context/motivation for instructions
   * MEDIUM certainty - "why" improves compliance
   */
  missing_context_why: {
    id: 'missing_context_why',
    category: 'context',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Instructions without explanation of why they matter',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      const tokens = estimateTokens(content);
      if (tokens < 400) return null;

      // Count imperatives/rules
      const rulePatterns = [
        /\b(?:must|should|always|never)\s+\w+/gi,
        /\bdo not\b/gi,
        /\b(?:required|mandatory)\b/gi
      ];

      let ruleCount = 0;
      for (const pattern of rulePatterns) {
        const matches = content.match(pattern);
        if (matches) ruleCount += matches.length;
      }

      // Check for "why" explanations
      const whyPatterns = [
        /\bbecause\b/gi,
        /\bsince\b/gi,
        /\bthis (?:is|ensures?|prevents?|helps?)/gi,
        /\bto (?:ensure|prevent|avoid|maintain)/gi,
        /\bwhy:\s/gi,
        /\*why\*/i,
        // Inline explanations after dashes: "Rule - Explanation with verb"
        // Requires verb-like word (ending in s/es/ed/ing) to distinguish from bullet points
        /[-–]\s+[A-Z][a-z]+(?:s|es|ed|ing)\s+\w+/g,
        // Inline explanations in parens with prose (8+ chars, no code-like content)
        /\([^)(){}\[\]]{8,}\)/g,
        // Explicit WHY/rationale sections
        /##?\s*(?:why|rationale|reason)/gi,
        // "for X" explanations: "for efficiency", "for safety"
        /\bfor\s+(?:efficiency|safety|performance|security|clarity|consistency|reliability|maintainability)/gi
      ];

      let whyCount = 0;
      for (const pattern of whyPatterns) {
        const matches = content.match(pattern);
        if (matches) whyCount += matches.length;
      }

      // Ratio check: should have some explanation for rules
      if (ruleCount >= 8 && whyCount < ruleCount * 0.3) {
        return {
          issue: `${ruleCount} rules but few explanations (${whyCount} "why" phrases)`,
          fix: 'Add context explaining WHY instructions matter (improves compliance)'
        };
      }
      return null;
    }
  },

  /**
   * Missing instruction hierarchy/priority
   * MEDIUM certainty - helps with conflicting instructions
   */
  missing_instruction_priority: {
    id: 'missing_instruction_priority',
    category: 'context',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'No clear priority order for instructions',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      const tokens = estimateTokens(content);
      if (tokens < 600) return null;

      // Check for instruction priority indicators
      const priorityIndicators = [
        /##\s*(?:priority|priorities)/i,
        /<instruction[_-]?priority>/i,
        /\bin case of conflict/i,
        /\bpriority\s*(?:order|:\s*\d)/i,
        /\b(?:highest|lowest)\s+priority\b/i,
        /\b(?:first|second|third)\s+priority\b/i,
        // Numbered rules section (implicit priority order)
        /##[ \t]*(?:critical|important)[ \t]*rules?[ \t]*\n[ \t]*1\.\s/i,
        // Precedence language
        /\btakes?\s+precedence\b/i,
        /\boverride[sd]?\b/i,
        // Ordered constraint list
        /##[ \t]*constraints?[ \t]*\n[ \t]*1\.\s/i
      ];

      for (const pattern of priorityIndicators) {
        if (pattern.test(content)) {
          return null;
        }
      }

      // Only flag if there are multiple top-level constraint sections (H2 only, not H3+)
      // Design decision: H3+ subsections are typically nested within a larger rules block
      // and don't indicate separate conflicting constraint sets
      const constraintSections = (content.match(/^##\s+(?:constraints?|rules?|requirements?)\b/gim) || []).length;

      // Design decision: Case-sensitive MUST to detect intentional emphasis only
      // Lowercase 'must' is common in prose and doesn't indicate constraint emphasis
      // Threshold of 10 chosen to avoid flagging files with few emphatic rules
      const mustClauses = (content.match(/\bMUST\b/g) || []).length;

      if (constraintSections >= 2 || mustClauses >= 10) {
        return {
          issue: 'Multiple constraint sections but no instruction priority order',
          fix: 'Add priority order: "In case of conflict: 1) Safety rules, 2) System instructions, 3) User requests"'
        };
      }
      return null;
    }
  },

  // ============================================
  // ANTI-PATTERN PATTERNS (HIGH/MEDIUM certainty)
  // ============================================

  /**
   * Redundant CoT for thinking models
   * HIGH certainty - wastes tokens with extended thinking models
   */
  redundant_cot: {
    id: 'redundant_cot',
    category: 'anti-pattern',
    certainty: 'HIGH',
    autoFix: false,
    description: '"Think step by step" redundant for models with extended thinking',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Skip if this is documentation ABOUT CoT (describes the anti-pattern)
      // These files explain why step-by-step is redundant, not actually use it
      const lcContent = content.toLowerCase();
      if (/step[- ]by[- ]step/i.test(content) && lcContent.includes('redundant')) {
        return null;
      }

      // Check for explicit CoT instructions
      const cotPatterns = [
        /\bthink\s+step[- ]by[- ]step\b/gi,
        /\bstep[- ]by[- ]step\s+(?:reasoning|thinking|approach)\b/gi,
        /\blet['']s\s+think\s+(?:through|about)\s+this\b/gi,
        /\breason\s+through\s+each\s+step\b/gi
      ];

      const cotMatches = [];
      for (const pattern of cotPatterns) {
        const matches = content.match(pattern);
        if (matches) cotMatches.push(...matches);
      }

      if (cotMatches.length >= 2) {
        return {
          issue: `${cotMatches.length} explicit "step-by-step" instructions`,
          fix: 'Remove redundant CoT prompting - Claude 4.x and GPT-4 models reason by default',
          details: cotMatches.slice(0, 3)
        };
      }
      return null;
    }
  },

  /**
   * Overly prescriptive process
   * MEDIUM certainty - micro-managing reasoning can limit creativity
   */
  overly_prescriptive: {
    id: 'overly_prescriptive',
    category: 'anti-pattern',
    certainty: 'LOW', // Some workflows need detailed steps
    autoFix: false,
    description: 'Overly prescriptive step-by-step process that may limit model reasoning',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Count numbered steps
      const numberedSteps = content.match(/^\s*\d+\.\s+\w+/gm) || [];

      // Check for micro-management indicators
      const microManagePatterns = [
        /\bfirst,?\s+(?:you\s+)?(?:must|should|need to)\b/gi,
        /\bthen,?\s+(?:you\s+)?(?:must|should|need to)\b/gi,
        /\bnext,?\s+(?:you\s+)?(?:must|should|need to)\b/gi,
        /\bfinally,?\s+(?:you\s+)?(?:must|should|need to)\b/gi
      ];

      let microManageCount = 0;
      for (const pattern of microManagePatterns) {
        const matches = content.match(pattern);
        if (matches) microManageCount += matches.length;
      }

      if (numberedSteps.length >= 10 || microManageCount >= 6) {
        return {
          issue: `${numberedSteps.length} numbered steps, ${microManageCount} sequential directives`,
          fix: 'Consider high-level goals over step-by-step processes - model creativity may exceed prescribed approach'
        };
      }
      return null;
    }
  },

  /**
   * Prompt bloat (excessive tokens)
   * LOW certainty - long prompts cost more
   */
  prompt_bloat: {
    id: 'prompt_bloat',
    category: 'anti-pattern',
    certainty: 'LOW',
    autoFix: false,
    description: 'Prompt exceeds recommended token count',
    maxTokens: 2500,
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      const tokens = estimateTokens(content);

      if (tokens > 2500) {
        return {
          issue: `Prompt ~${tokens} tokens (recommended max: 2500)`,
          fix: 'Consider splitting into smaller prompts or using XML compression'
        };
      }
      return null;
    }
  },

  // ============================================
  // OUTPUT FORMAT PATTERNS (MEDIUM certainty)
  // ============================================

  /**
   * JSON request without schema
   * MEDIUM certainty - schema improves consistency
   */
  json_without_schema: {
    id: 'json_without_schema',
    category: 'output',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Requests JSON output without providing schema/example',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Check if requests JSON (exclude CLI flags and function descriptions)
      // Exclude: "--output json", "analyzer returns JSON", "function returns JSON"
      const requestsJson = (
        (/\b(?:respond|output|return)[ \t]+(?:(?:with|in|as)[ \t]+)?JSON\b/i.test(content) &&
         !/--output\s+json/i.test(content) &&
         !/(?:analyzer|function|method)\s+returns?\s+JSON/i.test(content))
      ) ||
        /\bJSON\s+(?:object|response|format)\b/i.test(content);

      if (!requestsJson) return null;

      // Check if provides schema or example
      const hasSchema = /\bproperties\b.{1,200}\btype\b/is.test(content) ||
                       (content.includes('```json') && content.includes('{')) ||
                       /<json[_-]?schema>/i.test(content) ||
                       // JSON in JavaScript/TypeScript code blocks (quoted keys)
                       (/```(?:javascript|js|typescript|ts)\b/.test(content) && /\{\s*"[a-zA-Z]+"/i.test(content)) ||
                       // JavaScript object literal assignment (const x = { prop: ... })
                       (/\b(?:const|let|var)\b/.test(content) && /=\s*\{/.test(content)) ||
                       // JSON example with quoted property names in prose
                       /\{"[a-zA-Z_]+"[ \t]*:/i.test(content) || /\{\n[ \t]*"[a-zA-Z_]+"[ \t]*:/i.test(content) ||
                       // Inline schema description: { prop, prop, prop } or { prop: type, ... }
                       /\{[ \t]*[a-zA-Z_]+[ \t]*,[ \t]*[a-zA-Z_]+[ \t]*,[ \t]*[a-zA-Z_]+/i.test(content) ||
                       // Interface-style: { prop: value } patterns with multiple lines
                       /\{\n[ \t]+[a-zA-Z_]+[ \t]*:[ \t]*[\[\{"']/i.test(content);

      if (!hasSchema) {
        return {
          issue: 'Requests JSON output but no schema or example provided',
          fix: 'Add JSON schema or example structure to ensure consistent output format'
        };
      }
      return null;
    }
  },

  // ============================================
  // VERIFICATION PATTERNS (from Claude Code Best Practices)
  // Source: https://code.claude.com/docs/en/best-practices
  // ============================================

  /**
   * Missing verification criteria
   * HIGH certainty - single highest-leverage improvement
   * "Give Claude a way to verify its work"
   */
  missing_verification_criteria: {
    id: 'missing_verification_criteria',
    category: 'clarity',
    certainty: 'MEDIUM', // Context-dependent - not all prompts are task-oriented
    autoFix: true,
    description: 'Task lacks verification criteria (tests, screenshots, expected output)',
    check: (content, filePath) => {
      if (!content || typeof content !== 'string') return null;

      const tokens = estimateTokens(content);
      if (tokens < 150) return null; // Too short to need verification

      // Skip SKILL.md files (implementation definitions, not tasks)
      // Skip agent files (they define behavior, verification is in workflow)
      // Skip command files that delegate to agents (verification in agent)
      const isSkillOrAgent = /SKILL\.md$/i.test(filePath || '') ||
                            /[/\\]agents?[/\\]/i.test(filePath || '') ||
                            /^---\s*\nname:/m.test(content); // Agent frontmatter
      if (isSkillOrAgent) return null;

      // Design decision: Skip commands that delegate to agents
      // When a command uses Task({ subagent_type: ... }), verification responsibility
      // belongs to the spawned agent, not the orchestrating command.
      // This is project-specific syntax for AgentSys plugin system.
      if (/Task\s*\(/i.test(content) && /subagent_type/i.test(content)) return null;

      // Check for implementation/action indicators
      const isActionTask = /\b(?:implement|create|build|write|add|fix|update|refactor|modify)\b/i.test(content);
      if (!isActionTask) return null;

      // Check for verification indicators
      const verificationPatterns = [
        /\btest(?:s|ing)?\b/i,
        /\bverify\b/i,
        /\bvalidate\b/i,
        /\bscreenshot\b/i,
        /\bexpected\s+(?:output|result|behavior)\b/i,
        /\bshould\s+(?:return|output|produce)\b/i,
        /\bexample\s+(?:input|output)\b/i,
        /\bcheck\s+(?:that|if)\b/i,
        /\brun\s+(?:the\s+)?tests?\b/i,
        /\bcompare\s+(?:to|with)\b/i,
        /\bassert\b/i,
        // Performance verification
        /\bbaseline\b/i,
        /\bbenchmark\b/i,
        /\bprofil(?:e|ing)\b/i
      ];

      for (const pattern of verificationPatterns) {
        if (pattern.test(content)) {
          return null;
        }
      }

      return {
        issue: 'Task lacks verification criteria - no tests, expected output, or validation steps',
        fix: 'Add verification: "run tests after implementing" or "expected output: X" or "take screenshot and compare"'
      };
    }
  },

  /**
   * Unscoped task description
   * HIGH certainty - vague scope leads to wrong solutions
   */
  unscoped_task: {
    id: 'unscoped_task',
    category: 'clarity',
    certainty: 'HIGH',
    autoFix: false,
    description: 'Task description lacks specific scope (file, scenario, constraints)',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      const tokens = estimateTokens(content);
      if (tokens < 50) return null;

      // Check for action without scope
      const vagueActions = [
        /^(?:fix|add|implement|update|change)\s+(?:the|a|some)?\s*\w+$/im,
        /\bfix\s+(?:the\s+)?bug\b/i,
        /\badd\s+(?:a\s+)?(?:feature|function|test)\b/i,
        /\bupdate\s+(?:the\s+)?(?:code|logic)\b/i
      ];

      const hasVagueAction = vagueActions.some(p => p.test(content));

      // Check for scope indicators
      const scopePatterns = [
        /\bin\s+(?:file|folder|directory|module)\s+\S+/i,
        /\b(?:src|lib|test)\/\S+/,
        /\.(?:js|ts|py|rs|go|java|rb)\b/,
        /\bwhen\s+(?:the|a)\s+\w+/i,
        /\bfor\s+(?:the|a)\s+(?:case|scenario)\b/i,
        /\bspecifically\b/i,
        /\bedge\s+case/i
      ];

      const hasScope = scopePatterns.some(p => p.test(content));

      if (hasVagueAction && !hasScope && tokens < 200) {
        return {
          issue: 'Task lacks specific scope (which file, what scenario, what constraints)',
          fix: 'Specify: "in src/auth/login.js" or "for the edge case where user is logged out" or "without using library X"'
        };
      }
      return null;
    }
  },

  /**
   * Missing pattern reference
   * MEDIUM certainty - pointing to existing patterns improves consistency
   */
  missing_pattern_reference: {
    id: 'missing_pattern_reference',
    category: 'context',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Task could benefit from referencing existing patterns in codebase',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Only for tasks that involve creating new things
      const creationTasks = /\b(?:create|add|implement|build)\s+(?:a\s+)?(?:new\s+)?(?:component|widget|endpoint|handler|service|module)\b/i;
      if (!creationTasks.test(content)) return null;

      // Check for pattern reference indicators
      // Use string-based checks to avoid ReDoS from overlapping optional groups
      const lcRef = content.toLowerCase();
      if (/\blike\s+\S+\b/i.test(content) ||
          lcRef.includes('similar to') ||
          (lcRef.includes('follow') && lcRef.includes('pattern')) ||
          (lcRef.includes('see ') && lcRef.includes('example')) ||
          (lcRef.includes('look at')) ||
          (/\.(?:js|ts|py)\b/.test(content) && lcRef.includes('example'))) {
        return null;
      }

      return {
        issue: 'Creating new code without referencing existing patterns in codebase',
        fix: 'Add: "look at how widgets are implemented in HomePage.tsx" or "follow the pattern in existing handlers"'
      };
    }
  },

  /**
   * Missing source direction
   * MEDIUM certainty - directing to sources saves exploration time
   */
  missing_source_direction: {
    id: 'missing_source_direction',
    category: 'context',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Question/investigation without directing to likely sources',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Only for investigation/question tasks
      const investigationPatterns = [
        /\bwhy\s+does\b/i,
        /\bhow\s+does\b/i,
        /\bwhere\s+is\b/i,
        /\bwhat\s+(?:is|are|does)\b/i,
        /\bfind\s+(?:out|the)\b/i,
        /\binvestigate\b/i,
        /\bunderstand\b/i
      ];

      const isInvestigation = investigationPatterns.some(p => p.test(content));
      if (!isInvestigation) return null;

      // Check for source directions
      const sourceDirections = [
        /\blook\s+(?:at|in|through)\b/i,
        /\bcheck\s+(?:the|in)\b/i,
        /\bstart\s+(?:with|from|in)\b/i,
        /\bsee\s+\S+\b/i,
        /\bin\s+(?:the\s+)?\S+\s+(?:file|folder|directory)\b/i,
        /\bgit\s+(?:log|history|blame)\b/i
      ];

      for (const pattern of sourceDirections) {
        if (pattern.test(content)) {
          return null;
        }
      }

      const tokens = estimateTokens(content);
      if (tokens < 100) {
        return {
          issue: 'Investigation task without directing to likely sources',
          fix: 'Add: "look through git history" or "check the auth flow in src/auth/" or "start in the config files"'
        };
      }
      return null;
    }
  },

  // ============================================
  // CODE VALIDATION PATTERNS (HIGH/MEDIUM certainty)
  // ============================================

  /**
   * Invalid JSON in code blocks
   * HIGH certainty - JSON syntax errors are unambiguous
   */
  invalid_json_in_code_block: {
    id: 'invalid_json_in_code_block',
    category: 'code-validation',
    certainty: 'HIGH',
    autoFix: false,
    description: 'JSON code block contains invalid JSON syntax',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      const blocks = extractCodeBlocks(content);
      const jsonBlocks = blocks.filter(b =>
        b.language.toLowerCase() === 'json'
      );

      for (const block of jsonBlocks) {
        // Skip if inside bad-example tags
        const position = getPositionForLine(content, block.startLine);
        if (isInsideExampleTag(content, position)) {
          continue;
        }

        // Skip empty blocks
        if (!block.code.trim()) continue;

        // Skip very large blocks (>50KB) for performance
        if (block.code.length > 50000) continue;

        // Skip blocks with placeholder syntax (common in documentation)
        // e.g., [...], {...}, <...>, "...", etc.
        if (/\[\.\.\.\]|\{\.\.\.\}|<\.\.\.>|"\.\.\."|\.\.\./g.test(block.code)) continue;

        // Skip blocks with comments (// or /* */) - not valid JSON but common in docs
        if (/\/\/|\/\*/.test(block.code)) continue;

        // Skip blocks with template variables (${...}) - pseudo-code, not actual JSON
        if (/\$\{/.test(block.code)) continue;

        // Skip blocks with type union syntax (|) - schema docs, not actual JSON
        if (/\|/.test(block.code)) continue;

        try {
          JSON.parse(block.code);
        } catch (err) {
          return {
            issue: `Invalid JSON at line ${block.startLine}: ${err.message}`,
            fix: 'Fix JSON syntax error in the code block'
          };
        }
      }

      return null;
    }
  },

  // NOTE: JavaScript syntax validation removed - too many false positives
  // (modules, async/await, JSX, TypeScript not supported by Function constructor)
  // We can only reliably validate static formats: YAML frontmatter, JSON

  /**
   * Code language tag mismatch
   * MEDIUM certainty - heuristic detection may have false positives
   */
  code_language_mismatch: {
    id: 'code_language_mismatch',
    category: 'code-validation',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Code block language tag may not match actual content',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      const blocks = extractCodeBlocks(content);

      for (const block of blocks) {
        // Skip blocks without language tag or inside bad-example
        if (!block.language) continue;
        const position = getPositionForLine(content, block.startLine);
        if (isInsideExampleTag(content, position)) continue;

        // Skip empty blocks
        const code = block.code.trim();
        if (!code) continue;

        const lang = block.language.toLowerCase();

        // JSON detection: starts with { or [ and contains : or ,
        const looksLikeJson = LOOKS_LIKE_JSON_START.test(code) &&
                            LOOKS_LIKE_JSON_CONTENT.test(code) &&
                            !NOT_JSON_KEYWORDS.test(code);

        // JavaScript detection: has JS keywords
        const looksLikeJs = LOOKS_LIKE_JS.test(code);

        // Python detection: has Python keywords
        const looksLikePython = LOOKS_LIKE_PYTHON.test(code);

        // Check for clear mismatches
        if (lang === 'json' && looksLikeJs && !looksLikeJson) {
          return {
            issue: `Line ${block.startLine}: Code tagged as JSON but appears to be JavaScript`,
            fix: 'Change language tag from "json" to "javascript" or "js"'
          };
        }

        if (lang === 'json' && looksLikePython && !looksLikeJson) {
          return {
            issue: `Line ${block.startLine}: Code tagged as JSON but appears to be Python`,
            fix: 'Change language tag from "json" to "python"'
          };
        }

        if ((lang === 'js' || lang === 'javascript') && looksLikeJson && !looksLikeJs) {
          return {
            issue: `Line ${block.startLine}: Code tagged as JavaScript but appears to be JSON`,
            fix: 'Change language tag to "json"'
          };
        }

        if ((lang === 'js' || lang === 'javascript') && looksLikePython && !looksLikeJs) {
          return {
            issue: `Line ${block.startLine}: Code tagged as JavaScript but appears to be Python`,
            fix: 'Change language tag to "python"'
          };
        }

        if ((lang === 'python' || lang === 'py') && looksLikeJs && !looksLikePython) {
          return {
            issue: `Line ${block.startLine}: Code tagged as Python but appears to be JavaScript`,
            fix: 'Change language tag to "javascript" or "js"'
          };
        }
      }

      return null;
    }
  },

  /**
   * Heading hierarchy gaps
   * HIGH certainty - heading levels should not skip
   */
  heading_hierarchy_gaps: {
    id: 'heading_hierarchy_gaps',
    category: 'structure',
    certainty: 'HIGH',
    autoFix: false,
    description: 'Heading hierarchy skips levels (e.g., H1 to H3 without H2)',
    check: (content) => {
      if (!content || typeof content !== 'string') return null;

      // Get code block ranges to exclude headings inside them
      const codeBlocks = extractCodeBlocks(content);
      const codeBlockLines = new Set();
      for (const block of codeBlocks) {
        for (let line = block.startLine; line <= block.endLine; line++) {
          codeBlockLines.add(line);
        }
      }

      // Extract headings with their levels and line numbers (excluding code blocks)
      const lines = content.split('\n');
      const headings = [];

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        // Skip lines inside code blocks
        if (codeBlockLines.has(lineNum)) continue;

        const line = lines[i];
        const match = line.match(/^(#{1,6})[ \t]+(\S.*)$/);
        if (match) {
          headings.push({
            level: match[1].length,
            text: match[2].trim(),
            line: lineNum
          });
        }
      }

      // Need at least 2 headings to check hierarchy
      if (headings.length < 2) return null;

      // Check for gaps in hierarchy
      for (let i = 1; i < headings.length; i++) {
        const current = headings[i];
        const prev = headings[i - 1];

        // Only check if going to a more nested level
        if (current.level > prev.level && current.level - prev.level > 1) {
          return {
            issue: `Line ${current.line}: Heading jumps from H${prev.level} to H${current.level} (skipped H${prev.level + 1})`,
            fix: `Add intermediate H${prev.level + 1} heading or adjust heading levels to maintain hierarchy`
          };
        }
      }

      return null;
    }
  }
};

/**
 * Get all patterns
 * @returns {Object} All prompt patterns
 */
function getAllPatterns() {
  return promptPatterns;
}

/**
 * Get patterns by certainty level
 * @param {string} certainty - HIGH, MEDIUM, or LOW
 * @returns {Object} Filtered patterns
 */
function getPatternsByCertainty(certainty) {
  const result = {};
  for (const [name, pattern] of Object.entries(promptPatterns)) {
    if (pattern.certainty === certainty) {
      result[name] = pattern;
    }
  }
  return result;
}

/**
 * Get patterns by category
 * @param {string} category - clarity, structure, examples, context, output, anti-pattern
 * @returns {Object} Filtered patterns
 */
function getPatternsByCategory(category) {
  const result = {};
  for (const [name, pattern] of Object.entries(promptPatterns)) {
    if (pattern.category === category) {
      result[name] = pattern;
    }
  }
  return result;
}

/**
 * Get auto-fixable patterns
 * @returns {Object} Patterns with autoFix: true
 */
function getAutoFixablePatterns() {
  const result = {};
  for (const [name, pattern] of Object.entries(promptPatterns)) {
    if (pattern.autoFix) {
      result[name] = pattern;
    }
  }
  return result;
}

module.exports = {
  promptPatterns,
  estimateTokens,
  extractCodeBlocks,
  getAllPatterns,
  getPatternsByCertainty,
  getPatternsByCategory,
  getAutoFixablePatterns
};
