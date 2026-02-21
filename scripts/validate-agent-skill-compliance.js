#!/usr/bin/env node
/**
 * Validate Agent Skills Open Standard Compliance
 *
 * Checks:
 * 1. Agents that invoke skills have `Skill` tool in frontmatter
 * 2. Skill directory names match skill names in SKILL.md frontmatter
 * 3. Skill names follow the standard (lowercase, hyphens, max 64 chars)
 *
 * Exit codes:
 * 0 - All checks pass
 * 1 - Violations found
 */

const fs = require('fs');
const path = require('path');

const pluginsDir = path.join(__dirname, '..', 'plugins');

/**
 * Parse frontmatter from markdown content
 * Handles both single-line and YAML list formats for tools
 */
function parseFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;

  const frontmatter = {};
  const lines = frontmatterMatch[1].split('\n');
  let currentKey = null;
  let collectingList = false;
  let listItems = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this is a list item (starts with whitespace and -)
    if (collectingList && /^\s+-\s/.test(line)) {
      const item = line.replace(/^\s+-\s*/, '').trim();
      listItems.push(item);
      continue;
    }

    // If we were collecting a list and hit a non-list line, save the list
    if (collectingList) {
      frontmatter[currentKey] = listItems.join(', ');
      collectingList = false;
      listItems = [];
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    // Check if this starts a YAML list
    if (value === '' && i + 1 < lines.length && /^\s+-\s/.test(lines[i + 1])) {
      currentKey = key;
      collectingList = true;
      listItems = [];
      continue;
    }

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    frontmatter[key] = value;
  }

  if (collectingList) {
    frontmatter[currentKey] = listItems.join(', ');
  }

  return frontmatter;
}

/**
 * Check if agent content indicates it needs to invoke a skill
 */
function detectSkillInvocationRequirement(content) {
  const patterns = [
    /MUST execute the [`']?([a-z0-9-]+)[`']? skill/gi,
    /MUST invoke the [`']?([a-z0-9-]+)[`']? skill/gi,
    /execute the [`']?([a-z0-9-]+)[`']? skill/gi,
    /invoke the [`']?([a-z0-9-]+)[`']? skill/gi,
    /You MUST execute the.*skill/gi,
    /You MUST invoke the.*skill/gi,
    /MUST execute.*skill to/gi,
    /Do not bypass the skill/gi,
    /Invoke your skill/gi
  ];

  const evidence = [];
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      evidence.push(...matches);
    }
  }

  return {
    needsSkill: evidence.length > 0,
    evidence: [...new Set(evidence)]
  };
}

/**
 * Check if tools list includes Skill
 */
function hasSkillTool(toolsString) {
  if (!toolsString) return false;
  const tools = toolsString.split(/[,\s]+/).map(t => t.trim());
  return tools.some(t => t === 'Skill' || t.startsWith('Skill,') || t.endsWith(',Skill'));
}

/**
 * Get all agent files from all plugins
 */
function getAllAgentFiles() {
  const agents = [];
  if (!fs.existsSync(pluginsDir)) return agents;
  const plugins = fs.readdirSync(pluginsDir).filter(f =>
    fs.statSync(path.join(pluginsDir, f)).isDirectory()
  );

  for (const plugin of plugins) {
    const agentsDir = path.join(pluginsDir, plugin, 'agents');
    if (fs.existsSync(agentsDir)) {
      const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        agents.push({
          plugin,
          file,
          path: path.join(agentsDir, file)
        });
      }
    }
  }

  return agents;
}

/**
 * Get all skill directories from all plugins
 */
function getAllSkillDirs() {
  const skills = [];
  if (!fs.existsSync(pluginsDir)) return skills;
  const plugins = fs.readdirSync(pluginsDir).filter(f =>
    fs.statSync(path.join(pluginsDir, f)).isDirectory()
  );

  for (const plugin of plugins) {
    const skillsDir = path.join(pluginsDir, plugin, 'skills');
    if (fs.existsSync(skillsDir)) {
      const dirs = fs.readdirSync(skillsDir).filter(f => {
        const fullPath = path.join(skillsDir, f);
        return fs.statSync(fullPath).isDirectory() &&
               fs.existsSync(path.join(fullPath, 'SKILL.md'));
      });

      for (const dirName of dirs) {
        skills.push({
          plugin,
          dirName,
          skillPath: path.join(skillsDir, dirName, 'SKILL.md')
        });
      }
    }
  }

  return skills;
}

function main() {
  const issues = [];

  console.log('Validating Agent Skills Open Standard Compliance...\n');

  // Check 1: Agents invoking skills have Skill tool
  console.log('[1/3] Checking agents have Skill tool when needed...');
  const agents = getAllAgentFiles();

  for (const { plugin, file, path: agentPath } of agents) {
    const content = fs.readFileSync(agentPath, 'utf8');
    const frontmatter = parseFrontmatter(content);
    const { needsSkill, evidence } = detectSkillInvocationRequirement(content);

    if (needsSkill && (!frontmatter || !hasSkillTool(frontmatter.tools))) {
      issues.push({
        type: 'missing-skill-tool',
        file: `${plugin}/agents/${file}`,
        message: `Agent invokes skill but lacks Skill tool: "${evidence[0]}"`,
        fix: `Add 'Skill' to the tools field in frontmatter`
      });
    }
  }

  // Check 2: Skill directories match skill names
  console.log('[2/3] Checking skill directory names match skill names...');
  const skills = getAllSkillDirs();

  for (const { plugin, dirName, skillPath } of skills) {
    const content = fs.readFileSync(skillPath, 'utf8');
    const frontmatter = parseFrontmatter(content);

    if (!frontmatter || !frontmatter.name) {
      issues.push({
        type: 'missing-skill-name',
        file: `${plugin}/skills/${dirName}/SKILL.md`,
        message: `Skill is missing required 'name' field`,
        fix: `Add 'name: ${dirName}' to SKILL.md frontmatter`
      });
      continue;
    }

    if (frontmatter.name !== dirName) {
      issues.push({
        type: 'name-mismatch',
        file: `${plugin}/skills/${dirName}`,
        message: `Directory '${dirName}' doesn't match skill name '${frontmatter.name}'`,
        fix: `Rename directory to '${frontmatter.name}' or update name in SKILL.md`
      });
    }

    // Check 3: Skill name format
    if (!/^[a-z0-9-]+$/.test(frontmatter.name)) {
      issues.push({
        type: 'invalid-name-format',
        file: `${plugin}/skills/${dirName}/SKILL.md`,
        message: `Skill name '${frontmatter.name}' contains invalid characters`,
        fix: `Use only lowercase letters, numbers, and hyphens`
      });
    }

    if (frontmatter.name.length > 64) {
      issues.push({
        type: 'name-too-long',
        file: `${plugin}/skills/${dirName}/SKILL.md`,
        message: `Skill name exceeds 64 character limit (${frontmatter.name.length} chars)`,
        fix: `Shorten the skill name to 64 characters or less`
      });
    }

    if (!frontmatter.description) {
      issues.push({
        type: 'missing-description',
        file: `${plugin}/skills/${dirName}/SKILL.md`,
        message: `Skill is missing required 'description' field`,
        fix: `Add description explaining WHAT the skill does and WHEN to use it`
      });
    }
  }

  console.log('[3/3] Generating report...\n');

  // Report results
  if (issues.length === 0) {
    console.log('[OK] Agent Skills Open Standard Compliance');
    console.log(`     Checked ${agents.length} agents, ${skills.length} skills`);
    console.log('     All checks passed!\n');
    return 0;
  }

  console.log(`[ERROR] Found ${issues.length} compliance issue(s):\n`);

  for (const issue of issues) {
    console.log(`  - ${issue.file}`);
    console.log(`    ${issue.message}`);
    console.log(`    Fix: ${issue.fix}\n`);
  }

  console.log('See: checklists/new-skill.md for Agent Skills Open Standard requirements\n');
  return 1;
}

if (require.main === module) {
  const code = main();
  if (typeof code === 'number') process.exit(code);
}

module.exports = { main };
