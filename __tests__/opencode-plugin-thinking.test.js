const fs = require('fs');
const Module = require('module');
const path = require('path');
const ts = require('typescript');

function loadAgentSysPlugin() {
  const pluginPath = path.join(__dirname, '../adapters/opencode-plugin/index.ts');
  const source = fs.readFileSync(pluginPath, 'utf-8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    },
    fileName: pluginPath
  });
  const pluginModule = new Module(pluginPath, module);
  pluginModule.filename = pluginPath;
  pluginModule.paths = module.paths;
  pluginModule._compile(compiled.outputText, pluginPath);
  return pluginModule.exports.AgentSysPlugin;
}

describe('OpenCode MiniMax thinking configuration', () => {
  let chatParams;

  beforeAll(async () => {
    const plugin = await loadAgentSysPlugin()({ directory: process.cwd() });
    chatParams = plugin['chat.params'];
  });

  it('uses adaptive thinking for MiniMax-M3 with a positive agent budget', async () => {
    const output = {};

    await chatParams({
      agent: 'implementation-agent',
      model: { providerID: 'minimax', id: 'MiniMax-M3' }
    }, output);

    expect(output.options.thinking).toEqual({ type: 'adaptive' });
    expect(output.options.thinking).not.toHaveProperty('budgetTokens');
  });

  it('disables thinking for MiniMax-M3 with a zero agent budget', async () => {
    const output = {};

    await chatParams({
      agent: 'simple-fixer',
      model: { providerID: 'minimax', id: 'MiniMax-M3' }
    }, output);

    expect(output.options.thinking).toEqual({ type: 'disabled' });
    expect(output.options.thinking).not.toHaveProperty('budgetTokens');
  });

  it('preserves the always-on defaults for MiniMax-M2.7', async () => {
    const output = { options: { existing: true } };

    await chatParams({
      agent: 'implementation-agent',
      model: { providerID: 'minimax', id: 'MiniMax-M2.7' }
    }, output);

    expect(output).toEqual({ options: { existing: true } });
    expect(output.options).not.toHaveProperty('thinking');
  });
});
