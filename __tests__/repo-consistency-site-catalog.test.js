const { siteCatalogMismatches } = require('../scripts/validate-repo-consistency');

function content() {
  return {
    stats: [
      { value: '1', label: 'Plugins' },
      { value: '2', label: 'Agents' },
      { value: '1', label: 'Skills' }
    ],
    agents: {
      total: 2,
      by_model: [
        { model: 'Opus', agents: ['skillers-recommender'] },
        { model: 'Sonnet', agents: ['deslop-agent'] }
      ]
    }
  };
}

function page({ agents = 2, skills = 1, plugins = 1, opusCount = 1, sonnetCount = 1 } = {}) {
  return `
    <span class="stats__number" data-target="${plugins}"></span>
    <span class="stats__label">Plugins</span>
    <span class="stats__number" data-target="${agents}"></span>
    <span class="stats__label">Agents</span>
    <span class="stats__number" data-target="${skills}"></span>
    <span class="stats__label">Skills</span>
    <h2 id="as-title">${agents} Agents. ${skills} Skills.</h2>
    <button aria-controls="agent-tier-opus">Opus <span class="agent-tabs__count">${opusCount}</span></button>
    <div id="agent-tier-opus"><span class="agent-card__name">skillers-recommender</span></div>
    <button aria-controls="agent-tier-sonnet">Sonnet <span class="agent-tabs__count">${sonnetCount}</span></button>
    <div id="agent-tier-sonnet"><span class="agent-card__name">deslop-agent</span></div>
    <h3 class="agents-skills__skills-title">${skills} Skills across ${plugins} Plugins</h3>
    <span class="skill-card">deslop</span>
  `;
}

describe('site catalog grid', () => {
  const lists = { skillNames: ['deslop'], pluginCount: 1 };

  test('accepts a grid that matches the headings and content.json', () => {
    expect(siteCatalogMismatches(page(), content(), lists)).toEqual([]);
  });

  test('flags a heading that the cards do not add up to', () => {
    const html = page({ agents: 9, opusCount: 1 });
    const messages = siteCatalogMismatches(html, content(), lists);
    expect(messages.some(message => message.includes('says 9 agents'))).toBe(true);
  });

  test('flags a skill card the catalog does not list', () => {
    const html = page().replace('deslop', 'not-a-skill');
    const messages = siteCatalogMismatches(html, content(), lists);
    expect(messages.some(message => message.includes('not-a-skill'))).toBe(true);
    expect(messages.some(message => message.includes('deslop'))).toBe(true);
  });
});
