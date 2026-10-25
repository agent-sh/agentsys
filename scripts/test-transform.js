#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function main() {
  // Read the source file
  const content = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'ship', 'commands', 'ship.md'), 'utf8');

  // Apply transformation (same as installer)
  let transformed = content;

  // Transform code blocks
  transformed = transformed.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (match, lang, code) => {
      const langLower = (lang || '').toLowerCase();

      // Keep bash
      if (langLower === 'bash' || langLower === 'shell') {
        if (code.includes('node -e') && code.includes('require(')) {
          return '*(Bash with Node.js require - adapt for OpenCode)*';
        }
        return match;
      }

      // Keep simple bash-like commands
      if (!lang && (code.trim().startsWith('gh ') || code.trim().startsWith('git '))) {
        return match;
      }

      // Transform JS
      if (code.includes('require(') || code.includes('Task(') ||
          code.includes('const ') || code.includes('async ')) {
        let instructions = '';
        const taskMatches = [...code.matchAll(/Task\s*\(\s*\{[^}]*subagent_type:\s*["'](?:[^"':]+:)?([^"']+)["']/gs)];
        for (const tm of taskMatches) {
          instructions += '- Invoke `@' + tm[1] + '` agent\n';
        }
        if (code.includes('workflowState.startPhase')) {
          const pm = code.match(/startPhase\s*\(\s*['"]([^'"]+)['"]/);
          if (pm) instructions += '- Phase: ' + pm[1] + '\n';
        }
        if (instructions) return instructions;
        return '*(JS reference - not executable)*';
      }
      return match;
    }
  );

  // Remove remaining patterns outside code blocks
  transformed = transformed.replace(/await\s+Task\s*\(\s*\{[\s\S]*?\}\s*\);?/g, (match) => {
    const agentMatch = match.match(/subagent_type:\s*["'](?:[^"':]+:)?([^"']+)["']/);
    if (agentMatch) return 'Invoke `@' + agentMatch[1] + '` agent';
    return '*(Task call - use @agent syntax)*';
  });

  transformed = transformed.replace(/(?:const|let|var)\s+\{?[^}=\n]+\}?\s*=\s*require\s*\([^)]+\);?/g, '');
  transformed = transformed.replace(/require\s*\(['"][^'"]+['"]\)/g, '');

  // Check for remaining patterns
  const hasRequire = transformed.match(/require\s*\(/g);
  const hasTask = transformed.match(/await\s+Task\s*\(/g);

  console.log('Has require():', hasRequire ? hasRequire.length : 0);
  console.log('Has await Task():', hasTask ? hasTask.length : 0);
  console.log('');

  // Show a section with transformation
  const lines = transformed.split('\n');
  let inPhase2 = false;
  for (let i = 0; i < lines.length && i < 250; i++) {
    if (lines[i].includes('Phase 2')) inPhase2 = true;
    if (inPhase2 && i < 220) console.log(lines[i]);
    if (lines[i].includes('Phase 3') && inPhase2) break;
  }

  return 0;
}

if (require.main === module) {
  const code = main();
  if (typeof code === 'number') process.exit(code);
}

module.exports = { main };
