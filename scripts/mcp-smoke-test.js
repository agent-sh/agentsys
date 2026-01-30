#!/usr/bin/env node
/**
 * MCP Server smoke test - verify server can be loaded without errors
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function main() {
  console.log('MCP Server smoke test...\n');

  const mcpDir = path.join(__dirname, '..', 'mcp-server');
  const mcpPath = path.join(mcpDir, 'index.js');

  // Test 1: Verify the file exists
  if (!fs.existsSync(mcpPath)) {
    console.log('[ERROR] MCP server file not found');
    process.exit(1);
  }
  console.log('  [OK] MCP server file exists');

  // Test 2: Syntax check (node --check)
  try {
    execSync(`node --check "${mcpPath}"`, { stdio: 'pipe' });
    console.log('  [OK] Syntax valid');
  } catch (e) {
    console.log(`[ERROR] Syntax error: ${e.message}`);
    process.exit(1);
  }

  // Test 3: Verify MCP SDK is installed in mcp-server/node_modules
  const mcpSdkPath = path.join(mcpDir, 'node_modules', '@modelcontextprotocol', 'sdk');
  if (!fs.existsSync(mcpSdkPath)) {
    console.log('[ERROR] MCP SDK not installed in mcp-server/');
    console.log('   Run: cd mcp-server && npm ci');
    process.exit(1);
  }
  console.log('  [OK] MCP SDK installed');

  // Test 4: Verify lib dependencies exist
  const libDeps = [
    'lib/state/workflow-state.js',
    'lib/patterns/pipeline.js',
    'lib/cross-platform/index.js'
  ];

  const rootDir = path.join(__dirname, '..');
  for (const dep of libDeps) {
    const depPath = path.join(rootDir, dep);
    if (!fs.existsSync(depPath)) {
      console.log(`[ERROR] Missing dependency: ${dep}`);
      process.exit(1);
    }
    console.log(`  [OK] ${dep.split('/').pop()} exists`);
  }

  // Test 5: Verify TOOLS array is defined in source
  const content = fs.readFileSync(mcpPath, 'utf8');
  if (!content.includes('const TOOLS = [')) {
    console.log('[ERROR] TOOLS array not found in index.js');
    process.exit(1);
  }
  console.log('  [OK] TOOLS array defined');

  // Test 6: Count tools defined
  const toolMatches = content.match(/name: ['"](\w+)['"]/g);
  if (toolMatches && toolMatches.length >= 5) {
    console.log(`  [OK] ${toolMatches.length} tools defined`);
  } else {
    console.log('[ERROR] Expected at least 5 tools');
    process.exit(1);
  }

  console.log('\n[OK] MCP smoke test passed');
}

main();
