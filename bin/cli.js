#!/usr/bin/env node
/**
 * AgentSys CLI installer
 *
 * Install:  npm install -g agentsys@latest
 * Run:      agentsys
 * Update:   npm update -g agentsys
 * Remove:   npm uninstall -g agentsys && agentsys --remove
 */

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');
const { createGunzip } = require('zlib');

const VERSION = require('../package.json').version;
// Use the installed npm package directory as source (no git clone needed)
const PACKAGE_DIR = path.join(__dirname, '..');
const discovery = require('../lib/discovery');
const transforms = require('../lib/adapter-transforms');

// Valid tool names
const VALID_TOOLS = ['claude', 'opencode', 'codex'];

function getInstallDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  return path.join(home, '.agentsys');
}

function getClaudePluginsDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  return path.join(home, '.claude', 'plugins');
}

function getOpenCodeConfigDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome && xdgConfigHome.trim()) {
    return path.join(xdgConfigHome, 'opencode');
  }
  return path.join(home, '.config', 'opencode');
}

function getConfigPath(platform) {
  if (platform === 'opencode') {
    return path.join(getOpenCodeConfigDir(), 'opencode.json');
  }
  if (platform === 'codex') {
    const home = process.env.HOME || process.env.USERPROFILE;
    return path.join(home, '.codex', 'config.toml');
  }
  return null;
}

function commandExists(cmd) {
  try {
    execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', [cmd], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function parseArgs(args) {
  const result = {
    help: false,
    version: false,
    remove: false,
    development: false,
    stripModels: true, // Default: strip models
    tool: null,        // Single tool
    tools: [],         // Multiple tools
    only: [],          // --only flag: selective plugin install
    subcommand: null,  // 'update', 'list', 'install', 'remove', 'search'
    subcommandArg: null, // argument for subcommand (e.g. plugin name)
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.version = true;
    } else if (arg === '--remove' || arg === '--uninstall') {
      result.remove = true;
    } else if (arg === '--development' || arg === '--dev') {
      result.development = true;
    } else if (arg === '--no-strip' || arg === '-ns') {
      result.stripModels = false;
    } else if (arg === '--strip-models') {
      // Legacy flag, now default behavior
      result.stripModels = true;
    } else if (arg === '--only' && args[i + 1]) {
      const pluginList = args[i + 1].split(',').map(p => p.trim()).filter(Boolean);
      result.only.push(...pluginList);
      i++;
    } else if (arg === '--tool' && args[i + 1]) {
      const tool = args[i + 1].toLowerCase();
      if (VALID_TOOLS.includes(tool)) {
        result.tool = tool;
      } else {
        console.error(`[ERROR] Invalid tool: ${tool}. Valid options: ${VALID_TOOLS.join(', ')}`);
        process.exit(1);
      }
      i++;
    } else if (arg === '--tools' && args[i + 1]) {
      const toolList = args[i + 1].toLowerCase().split(',').map(t => t.trim());
      for (const tool of toolList) {
        if (!VALID_TOOLS.includes(tool)) {
          console.error(`[ERROR] Invalid tool: ${tool}. Valid options: ${VALID_TOOLS.join(', ')}`);
          process.exit(1);
        }
        result.tools.push(tool);
      }
      i++;
    } else if (['update', 'list', 'install', 'remove', 'search'].includes(arg)) {
      result.subcommand = arg;
      // Grab the next non-flag arg as subcommand argument (plugin name, search term)
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        result.subcommandArg = args[i + 1];
        i++;
      }
    }
  }

  // Environment variable override for strip models (legacy support)
  if (['0', 'false', 'no'].includes((process.env.AGENTSYS_STRIP_MODELS || '').toLowerCase())) {
    result.stripModels = false;
  }

  return result;
}

async function multiSelect(question, options) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`\n${question}\n`);
  console.log('Enter numbers separated by spaces (e.g., "1 2" or "1,2,3"), then press Enter:\n');

  options.forEach((opt, i) => {
    console.log(`  ${i + 1}) ${opt.label}`);
  });

  console.log();

  return new Promise((resolve) => {
    rl.question('Your selection: ', (answer) => {
      rl.close();

      // Parse input like "1 2 3" or "1,2,3" or "1, 2, 3"
      const nums = answer.split(/[\s,]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));

      const result = [];
      for (const num of nums) {
        if (num >= 1 && num <= options.length) {
          result.push(options[num - 1].value);
        }
      }

      resolve([...new Set(result)]); // Dedupe
    });
  });
}

function cleanOldInstallation(installDir) {
  if (fs.existsSync(installDir)) {
    console.log('Removing previous installation...');
    fs.rmSync(installDir, { recursive: true, force: true });
  }
}

function copyFromPackage(installDir) {
  console.log('Installing AgentSys files...');
  // Copy from npm package to ~/.agentsys
  fs.cpSync(PACKAGE_DIR, installDir, {
    recursive: true,
    filter: (src) => {
      // Skip node_modules and .git directories
      const basename = path.basename(src);
      return basename !== 'node_modules' && basename !== '.git';
    }
  });
}

function installDependencies(installDir) {
  console.log('Installing dependencies...');
  execSync('npm install --production', { cwd: installDir, stdio: 'inherit' });
}

// --- External Plugin Fetching ---

function getPluginCacheDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  return path.join(home, '.agentsys', 'plugins');
}

function loadMarketplace() {
  const marketplacePath = path.join(PACKAGE_DIR, '.claude-plugin', 'marketplace.json');
  if (!fs.existsSync(marketplacePath)) {
    console.error('[ERROR] marketplace.json not found at ' + marketplacePath);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
}

/**
 * Resolve plugin dependencies transitively.
 *
 * Circular dependencies are expected and handled: the `visiting` Set tracks
 * the current DFS path and short-circuits any back-edge (e.g. next-task ->
 * ship -> next-task), adding the already-visited node to `resolved` and
 * returning immediately so the traversal terminates without infinite recursion.
 *
 * @param {string[]} names - Plugin names to resolve
 * @param {Object} marketplace - Parsed marketplace.json
 * @returns {string[]} All required plugin names (deduplicated, topologically ordered)
 */
function resolvePluginDeps(names, marketplace) {
  const pluginMap = {};
  for (const p of marketplace.plugins) {
    pluginMap[p.name] = p;
  }

  // Validate requested names exist
  for (const name of names) {
    if (!pluginMap[name]) {
      console.error(`[ERROR] Unknown plugin: ${name}. Available: ${marketplace.plugins.map(p => p.name).join(', ')}`);
      process.exit(1);
    }
  }

  const resolved = new Set();
  const visiting = new Set();

  function visit(name) {
    if (resolved.has(name)) return;
    if (visiting.has(name)) {
      // Circular dep - just add it and stop recursing
      resolved.add(name);
      return;
    }
    visiting.add(name);

    const plugin = pluginMap[name];
    if (plugin && plugin.requires) {
      for (const dep of plugin.requires) {
        visit(dep);
      }
    }

    visiting.delete(name);
    resolved.add(name);
  }

  for (const name of names) {
    visit(name);
  }

  return [...resolved];
}

/**
 * Download a GitHub repo tarball and extract to cache directory.
 *
 * @param {string} name - Plugin name
 * @param {string} source - GitHub source URL (e.g. "github:agent-sh/agentsys-plugin-next-task")
 * @param {string} version - Expected version string
 * @returns {Promise<string>} Path to extracted plugin directory
 */
async function fetchPlugin(name, source, version) {
  const cacheDir = getPluginCacheDir();
  const pluginDir = path.join(cacheDir, name);
  const versionFile = path.join(pluginDir, '.version');

  // Check cache
  if (fs.existsSync(versionFile)) {
    const cached = fs.readFileSync(versionFile, 'utf8').trim();
    if (cached === version) {
      return pluginDir;
    }
  }

  // Parse source formats:
  //   "https://github.com/owner/repo" or "https://github.com/owner/repo#ref"
  //   "github:owner/repo" or "github:owner/repo#ref"
  let owner, repo, ref;
  const urlMatch = source.match(/github\.com\/([^/]+)\/([^/#]+)(?:#(.+))?/);
  const shortMatch = !urlMatch && source.match(/^github:([^/]+)\/([^#]+)(?:#(.+))?$/);
  const match = urlMatch || shortMatch;
  if (!match) {
    throw new Error(`Unsupported source format for ${name}: ${source}`);
  }
  owner = match[1];
  repo = match[2];
  ref = match[3] || `v${version}`;

  const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${ref}`;

  console.log(`  Fetching ${name}@${version} from ${owner}/${repo}...`);

  // Clean and recreate
  if (fs.existsSync(pluginDir)) {
    fs.rmSync(pluginDir, { recursive: true, force: true });
  }
  fs.mkdirSync(pluginDir, { recursive: true });

  // Download and extract tarball
  await downloadAndExtractTarball(tarballUrl, pluginDir);

  // Write version marker
  fs.writeFileSync(versionFile, version);

  return pluginDir;
}

/**
 * Download a tarball from URL and extract to dest directory.
 * Strips the top-level directory from the tarball (GitHub tarballs have owner-repo-sha/).
 */
function downloadAndExtractTarball(url, dest) {
  return new Promise((resolve, reject) => {
    const ghToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const request = (reqUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error(`Too many redirects fetching tarball from ${url}`));
        return;
      }
      const headers = {
        'User-Agent': `agentsys/${VERSION}`,
        'Accept': 'application/vnd.github+json'
      };
      if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`;
      https.get(reqUrl, { headers }, (res) => {
        // Follow redirects (GitHub API returns 302 to S3)
        if (res.statusCode === 301 || res.statusCode === 302) {
          res.resume();
          request(res.headers.location, redirectCount + 1);
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          const hint = res.statusCode === 403 ? ' (rate limited — set GITHUB_TOKEN env var)' : '';
          reject(new Error(`HTTP ${res.statusCode}${hint} fetching tarball from ${reqUrl}`));
          return;
        }

        // Use tar command to extract (available on all supported platforms)
        const tar = require('child_process').spawn('tar', [
          'xz', '--strip-components=1', '-C', dest
        ], { stdio: ['pipe', 'inherit', 'pipe'] });

        let stderr = '';
        tar.stderr.on('data', (d) => { stderr += d; });

        res.pipe(tar.stdin);

        tar.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`tar extraction failed (code ${code}): ${stderr}`));
          } else {
            resolve();
          }
        });

        tar.on('error', reject);
      }).on('error', reject);
    };

    request(url);
  });
}

/**
 * Discover plugins from the external cache directory (~/.agentsys/plugins/).
 * Falls back to PACKAGE_DIR/plugins/ if cache doesn't exist (bundled install).
 *
 * @param {string[]} [onlyPlugins] - If provided, only return these plugins
 * @returns {string} The root directory to use for plugin discovery
 */
function resolvePluginRoot(onlyPlugins) {
  const cacheDir = getPluginCacheDir();
  // If we have cached external plugins, use the cache dir
  if (fs.existsSync(cacheDir)) {
    const entries = fs.readdirSync(cacheDir).filter(e => {
      const pluginJson = path.join(cacheDir, e, '.claude-plugin', 'plugin.json');
      return fs.existsSync(pluginJson);
    });
    if (entries.length > 0) {
      // Return a synthetic root where plugins/ is the cache dir
      // We need to restructure: cache has ~/.agentsys/plugins/<name>/
      // but discovery expects <root>/plugins/<name>/
      // The cache dir IS the plugins dir, so root is its parent
      return path.join(cacheDir, '..');
    }
  }
  // Fallback to bundled
  return PACKAGE_DIR;
}

/**
 * Fetch all requested plugins (with dependency resolution) to the cache.
 *
 * @param {string[]} pluginNames - Plugins to fetch (empty = all)
 * @param {Object} marketplace - Parsed marketplace.json
 * @returns {Promise<string[]>} Names of fetched plugins
 */
async function fetchExternalPlugins(pluginNames, marketplace) {
  const pluginMap = {};
  for (const p of marketplace.plugins) {
    pluginMap[p.name] = p;
  }

  // Determine which plugins to fetch
  let toFetch;
  if (pluginNames.length > 0) {
    toFetch = resolvePluginDeps(pluginNames, marketplace);
  } else {
    toFetch = marketplace.plugins.map(p => p.name);
  }

  console.log(`\nFetching ${toFetch.length} plugin(s): ${toFetch.join(', ')}\n`);

  const fetched = [];
  const failed = [];
  for (const name of toFetch) {
    const plugin = pluginMap[name];
    if (!plugin) continue;

    // If source is local (starts with ./), plugin is bundled - just use PACKAGE_DIR
    if (!plugin.source || plugin.source.startsWith('./') || plugin.source.startsWith('../')) {
      // Bundled plugin, no fetch needed
      fetched.push(name);
      continue;
    }

    try {
      await fetchPlugin(name, plugin.source, plugin.version);
      fetched.push(name);
    } catch (err) {
      failed.push(name);
      console.error(`  [ERROR] Failed to fetch ${name}: ${err.message}`);
    }
  }

  if (failed.length > 0) {
    const missingDeps = failed.filter(f => toFetch.includes(f) && !pluginNames.includes(f));
    if (missingDeps.length > 0) {
      console.error(`\n  [WARN] Missing dependencies: ${missingDeps.join(', ')}`);
      console.error(`  Some plugins may not work correctly without their dependencies.`);
    }
  }

  return fetched;
}

/**
 * List installed plugins with versions.
 */
function listInstalledPlugins() {
  const cacheDir = getPluginCacheDir();
  console.log(`\nagentsys v${VERSION} - Installed plugins\n`);

  // Check cached external plugins
  if (fs.existsSync(cacheDir)) {
    const entries = fs.readdirSync(cacheDir).filter(e => {
      return fs.statSync(path.join(cacheDir, e)).isDirectory();
    }).sort();

    if (entries.length > 0) {
      console.log('External plugins (cached):');
      for (const name of entries) {
        const versionFile = path.join(cacheDir, name, '.version');
        const ver = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8').trim() : 'unknown';
        console.log(`  ${name}@${ver}`);
      }
      console.log();
    }
  }

  // Check bundled plugins
  const bundled = discovery.discoverPlugins(PACKAGE_DIR);
  if (bundled.length > 0) {
    console.log('Bundled plugins:');
    for (const name of bundled) {
      console.log(`  ${name}@${VERSION}`);
    }
    console.log();
  }

  console.log(`Cache directory: ${cacheDir}`);
}

/**
 * Re-fetch all installed external plugins (update to latest versions).
 */
async function updatePlugins() {
  console.log(`\nagentsys v${VERSION} - Updating plugins\n`);

  const marketplace = loadMarketplace();
  const cacheDir = getPluginCacheDir();

  if (!fs.existsSync(cacheDir)) {
    console.log('No cached plugins found. Run agentsys to install first.');
    return;
  }

  // Get currently installed external plugins
  const installed = fs.readdirSync(cacheDir).filter(e => {
    return fs.statSync(path.join(cacheDir, e)).isDirectory();
  });

  if (installed.length === 0) {
    console.log('No external plugins installed.');
    return;
  }

  // Force re-fetch by removing version files
  for (const name of installed) {
    const versionFile = path.join(cacheDir, name, '.version');
    if (fs.existsSync(versionFile)) {
      fs.unlinkSync(versionFile);
    }
  }

  await fetchExternalPlugins(installed, marketplace);
  console.log('\n[OK] Plugins updated.');
}

// --- installed.json manifest ---

function getInstalledJsonPath() {
  const home = process.env.HOME || process.env.USERPROFILE;
  return path.join(home, '.agentsys', 'installed.json');
}

function loadInstalledJson() {
  const p = getInstalledJsonPath();
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return { plugins: {} };
    }
  }
  return { plugins: {} };
}

function saveInstalledJson(data) {
  const p = getInstalledJsonPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

function recordInstall(name, version, platforms) {
  const data = loadInstalledJson();
  data.plugins[name] = {
    version,
    installedAt: new Date().toISOString(),
    platforms
  };
  saveInstalledJson(data);
}

function recordRemove(name) {
  const data = loadInstalledJson();
  delete data.plugins[name];
  saveInstalledJson(data);
}

// --- Core version compatibility check ---

/**
 * Simple semver range check. Supports ">=X.Y.Z" format.
 * Returns true if ver satisfies the range.
 */
function satisfiesRange(ver, range) {
  if (!range) return true;
  const parseVer = (s) => {
    const m = s.match(/^(\d+)\.(\d+)\.(\d+)/);
    return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null;
  };

  const greaterEq = range.match(/^>=(.+)$/);
  if (greaterEq) {
    const required = parseVer(greaterEq[1]);
    const actual = parseVer(ver);
    if (!required || !actual) return true;
    for (let i = 0; i < 3; i++) {
      if (actual[i] > required[i]) return true;
      if (actual[i] < required[i]) return false;
    }
    return true; // equal
  }
  return true; // unknown range format, don't block
}

function checkCoreCompat(pluginEntry) {
  if (pluginEntry.core && !satisfiesRange(VERSION, pluginEntry.core)) {
    console.error(`[WARN] ${pluginEntry.name} requires agentsys ${pluginEntry.core}, you have ${VERSION}`);
  }
}

// --- Detect which platforms are installed ---

function detectInstalledPlatforms() {
  const home = process.env.HOME || process.env.USERPROFILE;
  const platforms = [];
  if (fs.existsSync(path.join(home, '.claude'))) platforms.push('claude');
  const opencodeDir = getOpenCodeConfigDir();
  if (fs.existsSync(opencodeDir)) platforms.push('opencode');
  if (fs.existsSync(path.join(home, '.codex'))) platforms.push('codex');
  return platforms;
}

// --- install subcommand ---

async function installPlugin(nameWithVersion, args) {
  // Parse name[@version]
  const atIdx = nameWithVersion.indexOf('@');
  let name, requestedVersion;
  if (atIdx > 0) {
    name = nameWithVersion.slice(0, atIdx);
    requestedVersion = nameWithVersion.slice(atIdx + 1);
  } else {
    name = nameWithVersion;
  }

  const marketplace = loadMarketplace();
  const pluginMap = {};
  for (const p of marketplace.plugins) {
    pluginMap[p.name] = p;
  }

  if (!pluginMap[name]) {
    console.error(`[ERROR] Unknown plugin: ${name}`);
    console.error(`Available: ${marketplace.plugins.map(p => p.name).join(', ')}`);
    process.exit(1);
  }

  const plugin = pluginMap[name];
  checkCoreCompat(plugin);

  // Resolve deps
  const toFetch = resolvePluginDeps([name], marketplace);
  console.log(`\nInstalling ${name} (+ deps: ${toFetch.filter(n => n !== name).join(', ') || 'none'})\n`);

  // Fetch all
  for (const depName of toFetch) {
    const dep = pluginMap[depName];
    if (!dep || !dep.source || dep.source.startsWith('./')) continue;
    checkCoreCompat(dep);
    const ver = depName === name && requestedVersion ? requestedVersion : dep.version;
    try {
      await fetchPlugin(depName, dep.source, ver);
    } catch (err) {
      console.error(`  [ERROR] Failed to fetch ${depName}: ${err.message}`);
    }
  }

  // Determine platforms
  let platforms;
  if (args.tool) {
    platforms = [args.tool];
  } else if (args.tools.length > 0) {
    platforms = args.tools;
  } else {
    platforms = detectInstalledPlatforms();
    if (platforms.length === 0) platforms = ['claude']; // default
  }

  console.log(`Installing for platforms: ${platforms.join(', ')}`);

  // Use cache as install source
  const installDir = getInstallDir();
  const needsLocal = platforms.includes('opencode') || platforms.includes('codex');
  if (needsLocal && !fs.existsSync(path.join(installDir, 'lib'))) {
    // Need local install for transforms
    cleanOldInstallation(installDir);
    copyFromPackage(installDir);
  }

  for (const platform of platforms) {
    if (platform === 'claude') {
      // Claude uses marketplace install
      if (commandExists('claude')) {
        try { execSync('claude plugin marketplace add agent-sh/agentsys', { stdio: 'pipe' }); } catch {}
        for (const depName of toFetch) {
          if (!/^[a-z0-9][a-z0-9-]*$/.test(depName)) continue;
          try {
            execSync(`claude plugin install ${depName}@agentsys`, { stdio: 'pipe' });
          } catch {
            try { execSync(`claude plugin update ${depName}@agentsys`, { stdio: 'pipe' }); } catch {}
          }
        }
      }
    }
    // OpenCode and Codex get handled through normal install flow with cached plugins
  }

  if (platforms.includes('opencode') && installDir) {
    installForOpenCode(installDir, { stripModels: args.stripModels });
  }
  if (platforms.includes('codex') && installDir) {
    installForCodex(installDir);
  }

  // Record in installed.json
  for (const depName of toFetch) {
    const dep = pluginMap[depName];
    const ver = depName === name && requestedVersion ? requestedVersion : (dep ? dep.version : 'unknown');
    recordInstall(depName, ver, platforms);
  }

  console.log(`\n[OK] Installed ${name} successfully.`);
}

// --- remove subcommand ---

function removePlugin(name) {
  const marketplace = loadMarketplace();
  const installed = loadInstalledJson();

  if (!installed.plugins[name]) {
    console.error(`[ERROR] Plugin ${name} is not installed.`);
    process.exit(1);
  }

  // Check if any other installed plugin depends on this one
  for (const [otherName] of Object.entries(installed.plugins)) {
    if (otherName === name) continue;
    const entry = marketplace.plugins.find(p => p.name === otherName);
    if (entry && entry.requires && entry.requires.includes(name)) {
      console.error(`[WARN] ${otherName} depends on ${name}. It may not work correctly after removal.`);
    }
  }

  const platforms = installed.plugins[name].platforms || [];

  // Remove from cache
  const cacheDir = getPluginCacheDir();
  const pluginCacheDir = path.join(cacheDir, name);
  if (fs.existsSync(pluginCacheDir)) {
    fs.rmSync(pluginCacheDir, { recursive: true, force: true });
    console.log(`  Removed from cache: ${name}`);
  }

  // Remove from platforms
  if (platforms.includes('claude') && commandExists('claude')) {
    try {
      execSync(`claude plugin uninstall ${name}@agentsys`, { stdio: 'pipe' });
      console.log(`  Removed from Claude Code: ${name}`);
    } catch {}
  }

  if (platforms.includes('opencode')) {
    const opencodeDir = getOpenCodeConfigDir();
    console.log(`  [NOTE] OpenCode files may need manual cleanup in ${opencodeDir}`);
  }

  if (platforms.includes('codex')) {
    const home = process.env.HOME || process.env.USERPROFILE;
    const skillsDir = path.join(home, '.codex', 'skills');
    console.log(`  [NOTE] Codex skill files may need manual cleanup in ${skillsDir}`);
  }

  // Update installed.json
  recordRemove(name);
  console.log(`\n[OK] Removed ${name}.`);
}

// --- search subcommand ---

function searchPlugins(term) {
  const marketplace = loadMarketplace();
  let plugins = marketplace.plugins;

  if (term) {
    const lower = term.toLowerCase();
    plugins = plugins.filter(p =>
      p.name.toLowerCase().includes(lower) ||
      (p.description && p.description.toLowerCase().includes(lower))
    );
  }

  if (plugins.length === 0) {
    console.log(`No plugins found${term ? ` matching "${term}"` : ''}.`);
    return;
  }

  // Print table
  const nameWidth = Math.max(14, ...plugins.map(p => p.name.length)) + 2;
  const verWidth = 10;
  console.log(`\n${'NAME'.padEnd(nameWidth)}${'VERSION'.padEnd(verWidth)}DESCRIPTION`);
  console.log(`${'─'.repeat(nameWidth)}${'─'.repeat(verWidth)}${'─'.repeat(40)}`);
  for (const p of plugins) {
    const desc = p.description ? (p.description.length > 60 ? p.description.slice(0, 57) + '...' : p.description) : '';
    console.log(`${p.name.padEnd(nameWidth)}${(p.version || '').padEnd(verWidth)}${desc}`);
  }
  console.log(`\n${plugins.length} plugin(s) found.`);
}

function installForClaude() {
  console.log('\n[INSTALL] Installing for Claude Code...\n');

  if (!commandExists('claude')) {
    console.log('[WARN]  Claude Code CLI not detected.');
    console.log('   Install it first: https://claude.ai/code\n');
    console.log('   Then run in Claude Code:');
    console.log('   /plugin marketplace add agent-sh/agentsys');
    console.log('   /plugin install next-task@agentsys\n');
    return false;
  }

  try {
    // Add GitHub marketplace
    console.log('Adding marketplace...');
    try {
      execSync('claude plugin marketplace add agent-sh/agentsys', { stdio: 'pipe' });
    } catch {
      // May already exist
    }

    // Discover plugins from filesystem convention
    const plugins = discovery.discoverPlugins(PACKAGE_DIR);
    const failedPlugins = [];
    for (const plugin of plugins) {
      // Validate plugin name before shell use (prevents injection)
      if (!/^[a-z0-9][a-z0-9-]*$/.test(plugin)) continue;
      console.log(`  Installing ${plugin}...`);
      // Remove pre-rename plugin ID to prevent dual loading on upgrade
      try {
        execSync(`claude plugin uninstall ${plugin}@awesome-slash`, { stdio: 'pipe' });
      } catch {
        // Not installed under old name
      }
      try {
        // Try install first
        execSync(`claude plugin install ${plugin}@agentsys`, { stdio: 'pipe' });
      } catch {
        // If install fails (already installed), try update
        try {
          execSync(`claude plugin update ${plugin}@agentsys`, { stdio: 'pipe' });
        } catch {
          failedPlugins.push(plugin);
        }
      }
    }

    if (failedPlugins.length > 0) {
      console.log(`\n[ERROR] Failed to install/update ${failedPlugins.length} plugin(s): ${failedPlugins.join(', ')}`);
      console.log('Retry with: /plugin install <plugin>@agentsys');
      return false;
    }

    console.log('\n[OK] Claude Code installation complete!\n');
    console.log('Commands: ' + plugins.map(p => '/' + p).join(', '));
    return true;
  } catch (err) {
    console.log('[ERROR] Auto-install failed. Manual installation:');
    console.log('   /plugin marketplace add agent-sh/agentsys');
    console.log('   /plugin install next-task@agentsys');
    return false;
  }
}

function installForClaudeDevelopment() {
  console.log('\n[INSTALL] Installing for Claude Code (DEVELOPMENT MODE)...\n');

  if (!commandExists('claude')) {
    console.log('[WARN]  Claude Code CLI not detected.');
    console.log('   Install it first: https://claude.ai/code\n');
    return false;
  }

  const pluginsDir = getClaudePluginsDir();
  const plugins = discovery.discoverPlugins(PACKAGE_DIR);

  // Remove marketplace plugins first
  console.log('Removing marketplace plugins...');
  try {
    execSync('claude plugin marketplace remove agent-sh/agentsys', { stdio: 'pipe' });
    console.log('  [OK] Removed marketplace');
  } catch {
    // May not exist
  }

  for (const plugin of plugins) {
    // Validate plugin name before shell use (prevents injection)
    if (!/^[a-z0-9][a-z0-9-]*$/.test(plugin)) continue;
    // Uninstall both current and pre-rename plugin IDs
    for (const suffix of ['agentsys', 'awesome-slash']) {
      try {
        execSync(`claude plugin uninstall ${plugin}@${suffix}`, { stdio: 'pipe' });
        console.log(`  [OK] Uninstalled ${plugin}@${suffix}`);
      } catch {
        // May not be installed
      }
    }
  }

  // Create plugins directory
  fs.mkdirSync(pluginsDir, { recursive: true });

  // Copy each plugin directly
  console.log('\nCopying plugins from package...');
  for (const plugin of plugins) {
    const srcDir = path.join(PACKAGE_DIR, 'plugins', plugin);
    const destDir = path.join(pluginsDir, `${plugin}@agentsys`);

    if (fs.existsSync(srcDir)) {
      // Remove existing
      if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true, force: true });
      }

      // Copy plugin
      fs.cpSync(srcDir, destDir, {
        recursive: true,
        filter: (src) => {
          const basename = path.basename(src);
          return basename !== 'node_modules' && basename !== '.git';
        }
      });
      console.log(`  [OK] Installed ${plugin}`);
    }
  }

  console.log('\n[OK] Claude Code development installation complete!');
  console.log('  Plugins installed to: ' + pluginsDir);
  console.log('  Commands: ' + plugins.map(p => '/' + p).join(', '));
  console.log('\n[NOTE] To revert to marketplace version:');
  console.log('  rm -rf ~/.claude/plugins/*@agentsys');
  console.log('  agentsys --tool claude');
  return true;
}

function installForOpenCode(installDir, options = {}) {
  console.log('\n[INSTALL] Installing for OpenCode...\n');
  const { stripModels = true } = options;

  if (stripModels) {
    console.log('  [INFO] Model specifications stripped (default). Use --no-strip to include.');
  } else {
    console.log('  [INFO] Model specifications included (--no-strip).');
  }

  const home = process.env.HOME || process.env.USERPROFILE;
  const opencodeConfigDir = getOpenCodeConfigDir();
  // OpenCode global locations are under ~/.config/opencode (or $XDG_CONFIG_HOME/opencode).
  const commandsDir = path.join(opencodeConfigDir, 'commands');
  const pluginDir = path.join(opencodeConfigDir, 'plugins');
  const agentsDir = path.join(opencodeConfigDir, 'agents');

  fs.mkdirSync(commandsDir, { recursive: true });
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.mkdirSync(agentsDir, { recursive: true });

  // Install native OpenCode plugin (auto-thinking, workflow enforcement, compaction)
  const pluginSrcDir = path.join(installDir, 'adapters', 'opencode-plugin');
  if (fs.existsSync(pluginSrcDir)) {
    // OpenCode loads plugin files directly from the plugins directory.
    const srcPath = path.join(pluginSrcDir, 'index.ts');
    const destPath = path.join(pluginDir, 'agentsys.ts');
    // Remove legacy plugin file from pre-rename installs to prevent dual loading
    const legacyPluginFile = path.join(pluginDir, 'awesome-slash.ts');
    if (fs.existsSync(legacyPluginFile)) {
      fs.unlinkSync(legacyPluginFile);
    }
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log('  [OK] Installed native plugin (auto-thinking, workflow enforcement)');
    }
  }

  // Clean up the legacy (pre-XDG) install location if it exists.
  // This location is not used by OpenCode and was used by older versions.
  const legacyCommandsDir = path.join(home, '.opencode', 'commands', 'agentsys');
  if (fs.existsSync(legacyCommandsDir)) {
    fs.rmSync(legacyCommandsDir, { recursive: true, force: true });
  }
  const legacyPluginDir = path.join(home, '.opencode', 'plugins', 'agentsys');
  if (fs.existsSync(legacyPluginDir)) {
    fs.rmSync(legacyPluginDir, { recursive: true, force: true });
  }
  // Also clean pre-rename paths (awesome-slash) for users upgrading from v4.x
  const preRenameCommandsDir = path.join(home, '.opencode', 'commands', 'awesome-slash');
  if (fs.existsSync(preRenameCommandsDir)) {
    fs.rmSync(preRenameCommandsDir, { recursive: true, force: true });
  }
  const preRenamePluginDir = path.join(home, '.opencode', 'plugins', 'awesome-slash');
  if (fs.existsSync(preRenamePluginDir)) {
    fs.rmSync(preRenamePluginDir, { recursive: true, force: true });
  }

  // Discover command mappings from filesystem
  const commandMappings = discovery.getCommandMappings(installDir);

  // Transform and copy command files
  for (const [target, plugin, source] of commandMappings) {
    const srcPath = path.join(installDir, 'plugins', plugin, 'commands', source);
    const destPath = path.join(commandsDir, target);
    if (fs.existsSync(srcPath)) {
      let content = fs.readFileSync(srcPath, 'utf8');
      content = transforms.transformBodyForOpenCode(content, installDir);
      content = transforms.transformCommandFrontmatterForOpenCode(content);
      fs.writeFileSync(destPath, content);
    }
  }

  // Remove legacy agent files from pre-rename installs.
  const legacyAgentFiles = ['review.md', 'ship.md', 'workflow.md'];
  for (const legacyFile of legacyAgentFiles) {
    const legacyPath = path.join(agentsDir, legacyFile);
    if (fs.existsSync(legacyPath)) {
      fs.unlinkSync(legacyPath);
    }
  }

  // Install agents to global OpenCode location
  // OpenCode looks for agents in ~/.config/opencode/agents/ (global) or .opencode/agents/ (per-project)

  console.log('  Installing agents for OpenCode...');
  const pluginDirs = discovery.discoverPlugins(installDir);
  let agentCount = 0;

  for (const pluginName of pluginDirs) {
    const srcAgentsDir = path.join(installDir, 'plugins', pluginName, 'agents');
    if (fs.existsSync(srcAgentsDir)) {
      const agentFiles = fs.readdirSync(srcAgentsDir).filter(f => f.endsWith('.md'));
      for (const agentFile of agentFiles) {
        const srcPath = path.join(srcAgentsDir, agentFile);
        const destPath = path.join(agentsDir, agentFile);
        let content = fs.readFileSync(srcPath, 'utf8');

        // Transform body and frontmatter for OpenCode
        content = transforms.transformBodyForOpenCode(content, installDir);
        content = transforms.transformAgentFrontmatterForOpenCode(content, { stripModels });

        fs.writeFileSync(destPath, content);
        agentCount++;
      }
    }
  }
  console.log(`  [OK] Installed ${agentCount} agents to ${agentsDir}`);

  // Copy lib files to commands directory for require() access
  const libSrcDir = path.join(installDir, 'lib');
  const libDestDir = path.join(commandsDir, 'lib');
  if (fs.existsSync(libSrcDir)) {
    console.log('  Installing lib files...');
    copyDirRecursive(libSrcDir, libDestDir);
    console.log(`  [OK] Installed lib to ${libDestDir}`);
  }

  // Install skills to the OpenCode global skills directory (~/.config/opencode/skills/<skill-name>/SKILL.md)
  const skillsDestDir = path.join(opencodeConfigDir, 'skills');
  fs.mkdirSync(skillsDestDir, { recursive: true });
  console.log('  Installing skills...');
  let skillCount = 0;

  for (const pluginName of pluginDirs) {
    const srcSkillsDir = path.join(installDir, 'plugins', pluginName, 'skills');
    if (fs.existsSync(srcSkillsDir)) {
      const skillDirs = fs.readdirSync(srcSkillsDir, { withFileTypes: true })
        .filter(d => d.isDirectory());
      for (const skillDir of skillDirs) {
        const skillName = skillDir.name;
        const srcSkillPath = path.join(srcSkillsDir, skillName, 'SKILL.md');
        if (fs.existsSync(srcSkillPath)) {
          const destSkillDir = path.join(skillsDestDir, skillName);
          fs.mkdirSync(destSkillDir, { recursive: true });
          let content = fs.readFileSync(srcSkillPath, 'utf8');
          content = transforms.transformSkillBodyForOpenCode(content, installDir);
          fs.writeFileSync(path.join(destSkillDir, 'SKILL.md'), content);
          skillCount++;
        }
      }
    }
  }
  console.log(`  [OK] Installed ${skillCount} skills to ${skillsDestDir}`);

  console.log('[OK] OpenCode installation complete!');
  console.log(`   Commands: ${commandsDir}`);
  console.log(`   Agents: ${agentsDir}`);
  console.log(`   Plugin: ${pluginDir}`);
  console.log('   Access via: ' + commandMappings.map(([target]) => '/' + target.replace(/\.md$/, '')).join(', '));
  console.log('   Native features: Auto-thinking selection, workflow enforcement, session compaction\n');
  return true;
}

function installForCodex(installDir) {
  console.log('\n[INSTALL] Installing for Codex CLI...\n');

  const home = process.env.HOME || process.env.USERPROFILE;
  const configDir = path.join(home, '.codex');
  const skillsDir = path.join(configDir, 'skills');

  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });

  // Remove old/deprecated prompts directory if it exists
  const oldPromptsDir = path.join(configDir, 'prompts');
  if (fs.existsSync(oldPromptsDir)) {
    const oldFiles = ['next-task.md', 'ship.md', 'deslop.md', 'audit-project.md',
                      'drift-detect.md', 'delivery-approval.md', 'sync-docs.md',
                      'drift-detect-set.md', 'pr-merge.md'];
    for (const file of oldFiles) {
      const oldPath = path.join(oldPromptsDir, file);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
        console.log(`  Removed old prompt: ${file}`);
      }
    }
  }

  // Remove old/deprecated skills
  const oldSkillDirs = ['deslop', 'review', 'drift-detect-set', 'pr-merge'];
  for (const dir of oldSkillDirs) {
    const oldPath = path.join(skillsDir, dir);
    if (fs.existsSync(oldPath)) {
      fs.rmSync(oldPath, { recursive: true, force: true });
      console.log(`  Removed deprecated skill: ${dir}`);
    }
  }

  // Discover skill mappings from filesystem (descriptions from codex-description frontmatter)
  const skillMappings = discovery.getCodexSkillMappings(installDir);

  for (const [skillName, plugin, sourceFile, description] of skillMappings) {
    if (!description) {
      console.log(`  [WARN] Skipping skill ${skillName}: missing description`);
      continue;
    }
    const srcPath = path.join(installDir, 'plugins', plugin, 'commands', sourceFile);
    const skillDir = path.join(skillsDir, skillName);
    const destPath = path.join(skillDir, 'SKILL.md');

    if (fs.existsSync(srcPath)) {
      if (fs.existsSync(skillDir)) {
        fs.rmSync(skillDir, { recursive: true, force: true });
      }
      // Create skill directory
      fs.mkdirSync(skillDir, { recursive: true });

      // Read source file and transform using shared transforms
      let content = fs.readFileSync(srcPath, 'utf8');
      const pluginInstallPath = path.join(installDir, 'plugins', plugin);
      content = transforms.transformForCodex(content, {
        skillName,
        description,
        pluginInstallPath
      });

      fs.writeFileSync(destPath, content);
      console.log(`  [OK] Installed skill: ${skillName}`);
    }
  }

  console.log('\n[OK] Codex CLI installation complete!');
  console.log(`   Config: ${configDir}`);
  console.log(`   Skills: ${skillsDir}`);
  console.log('   Access via: $next-task, $ship, $deslop, etc.\n');
  return true;
}

function removeInstallation() {
  const installDir = getInstallDir();

  if (!fs.existsSync(installDir)) {
    console.log('Nothing to remove. agentsys is not installed.');
    return;
  }

  console.log('Removing agentsys...');
  fs.rmSync(installDir, { recursive: true, force: true });

  console.log('\n[OK] Removed ~/.agentsys');
  console.log('\nTo fully uninstall, also remove:');
  console.log('  - Claude: /plugin marketplace remove agentsys');
  console.log('  - OpenCode: Remove files under ~/.config/opencode/ (commands/*.md, agents/*.md, skills/*/SKILL.md) and ~/.config/opencode/plugins/agentsys.ts');
  console.log('  - Codex: Remove ~/.codex/skills/*/');
}

function printHelp() {
  console.log(`
agentsys v${VERSION} - Workflow automation for AI coding assistants

Usage:
  agentsys                    Interactive installer (select platforms)
  agentsys --tool <name>      Install for single tool (claude, opencode, codex)
  agentsys --tools <list>     Install for multiple tools (comma-separated)
  agentsys --only <plugins>   Install only specified plugins (comma-separated, resolves deps)
  agentsys --development      Development mode: install to ~/.claude/plugins
  agentsys --no-strip, -ns    Include model specifications (stripped by default)
  agentsys --remove           Remove local installation
  agentsys --version, -v      Show version
  agentsys --help, -h         Show this help
  agentsys install <plugin>    Install a specific plugin (resolves deps)
  agentsys install <p>@<ver>  Install a specific version
  agentsys remove <plugin>    Remove an installed plugin
  agentsys search [term]      Search available plugins
  agentsys list               List installed plugins and versions
  agentsys update             Re-fetch latest versions of installed plugins

Non-Interactive Examples:
  agentsys --tool claude              # Install for Claude Code only
  agentsys --tool opencode            # Install for OpenCode only
  agentsys --tools "claude,opencode"  # Install for both
  agentsys --tools claude,opencode,codex  # Install for all three
  agentsys --only next-task           # Install next-task + its dependencies
  agentsys --only "next-task,perf"    # Install specific plugins + deps

Development Mode:
  agentsys --development      # Install plugins directly to ~/.claude/plugins
                                   # Bypasses marketplace for testing RC versions

Model Handling:
  By default, model specifications (sonnet/opus/haiku) are stripped from agents
  when installing for OpenCode. This is because most users don't have the
  required model mappings configured. Use --no-strip or -ns to include models.

Environment Variables:
  AGENTSYS_STRIP_MODELS=0     Same as --no-strip

Supported Platforms:
  claude   - Claude Code (marketplace install or development mode)
  opencode - OpenCode (local commands + native plugin)
  codex    - Codex CLI (local skills)

Install:  npm install -g agentsys && agentsys
Update:   npm update -g agentsys && agentsys
Remove:   npm uninstall -g agentsys && agentsys --remove

Docs: https://github.com/agent-sh/agentsys
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Handle --remove / --uninstall
  if (args.remove) {
    removeInstallation();
    return;
  }

  // Handle --version
  if (args.version) {
    console.log(`agentsys v${VERSION}`);
    return;
  }

  // Handle --help
  if (args.help) {
    printHelp();
    return;
  }

  // Handle subcommands
  if (args.subcommand === 'list') {
    listInstalledPlugins();
    return;
  }

  if (args.subcommand === 'update') {
    await updatePlugins();
    return;
  }

  if (args.subcommand === 'search') {
    searchPlugins(args.subcommandArg);
    return;
  }

  if (args.subcommand === 'install') {
    if (!args.subcommandArg) {
      console.error('[ERROR] Usage: agentsys install <plugin[@version]>');
      process.exit(1);
    }
    await installPlugin(args.subcommandArg, args);
    return;
  }

  if (args.subcommand === 'remove') {
    if (!args.subcommandArg) {
      console.error('[ERROR] Usage: agentsys remove <plugin>');
      process.exit(1);
    }
    removePlugin(args.subcommandArg);
    return;
  }

  // Determine which tools to install
  let selected = [];

  if (args.tool) {
    // Single tool specified
    selected = [args.tool];
  } else if (args.tools.length > 0) {
    // Multiple tools specified
    selected = args.tools;
  }

  // If no tools specified via flags, show interactive prompt
  if (selected.length === 0) {
    const title = `agentsys v${VERSION}`;
    const subtitle = 'Workflow automation for AI assistants';
    const width = Math.max(title.length, subtitle.length) + 6;
    const pad = (str) => {
      const left = Math.floor((width - str.length) / 2);
      const right = width - str.length - left;
      return ' '.repeat(left) + str + ' '.repeat(right);
    };

    console.log(`
┌${'─'.repeat(width)}┐
│${pad(title)}│
│${' '.repeat(width)}│
│${pad(subtitle)}│
└${'─'.repeat(width)}┘
`);

    // Multi-select platforms
    const options = [
      { value: 'claude', label: 'Claude Code' },
      { value: 'opencode', label: 'OpenCode' },
      { value: 'codex', label: 'Codex CLI' }
    ];

    selected = await multiSelect(
      'Which platforms do you want to install for?',
      options
    );

    if (selected.length === 0) {
      console.log('\nNo platforms selected. Exiting.');
      console.log('\nFor Claude Code, you can also install directly:');
      console.log('  /plugin marketplace add agent-sh/agentsys');
      process.exit(0);
    }
  }

  console.log(`\nInstalling for: ${selected.join(', ')}\n`);

  // Fetch external plugins to cache
  const marketplace = loadMarketplace();
  const onlyPlugins = args.only;
  const pluginNames = onlyPlugins.length > 0 ? onlyPlugins : marketplace.plugins.map(p => p.name);

  // Check core version compatibility
  for (const pName of pluginNames) {
    const entry = marketplace.plugins.find(p => p.name === pName);
    if (entry) checkCoreCompat(entry);
  }

  await fetchExternalPlugins(pluginNames, marketplace);

  // Only copy to ~/.agentsys if OpenCode or Codex selected (they need local files)
  const needsLocalInstall = selected.includes('opencode') || selected.includes('codex');
  let installDir = null;

  if (needsLocalInstall) {
    installDir = getInstallDir();
    cleanOldInstallation(installDir);
    copyFromPackage(installDir);
    installDependencies(installDir);
  }

  // Install for each platform
  const failedPlatforms = [];
  for (const platform of selected) {
    switch (platform) {
      case 'claude':
        if (args.development && !installForClaudeDevelopment()) {
          failedPlatforms.push('claude');
        } else {
          if (!args.development && !installForClaude()) {
            failedPlatforms.push('claude');
          }
        }
        break;
      case 'opencode':
        if (!installForOpenCode(installDir, { stripModels: args.stripModels })) {
          failedPlatforms.push('opencode');
        }
        break;
      case 'codex':
        if (!installForCodex(installDir)) {
          failedPlatforms.push('codex');
        }
        break;
    }
  }

  if (failedPlatforms.length > 0) {
    console.log(`\n[ERROR] Installation failed for: ${failedPlatforms.join(', ')}`);
    process.exitCode = 1;
  }

  console.log('─'.repeat(45));
  if (installDir) {
    console.log(`\nInstallation directory: ${installDir}`);
  }
  console.log('\nTo update:  npm update -g agentsys');
  console.log('To remove:  npm uninstall -g agentsys && agentsys --remove');
  console.log('\nDocs: https://github.com/agent-sh/agentsys');
}

// Export for testing when required as module
if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  VALID_TOOLS,
  resolvePluginDeps,
  fetchPlugin,
  fetchExternalPlugins,
  resolvePluginRoot,
  loadMarketplace,
  getPluginCacheDir,
  listInstalledPlugins,
  updatePlugins,
  installPlugin,
  removePlugin,
  searchPlugins,
  loadInstalledJson,
  saveInstalledJson,
  recordInstall,
  recordRemove,
  satisfiesRange,
  checkCoreCompat,
  detectInstalledPlatforms,
  getInstalledJsonPath
};
