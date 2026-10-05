# Source quality

Rate each candidate 1 to 10 on five factors. The weights say what matters most for a learning guide.

| Factor | Weight | High (9-10) | Low (1-3) |
|--------|--------|-------------|-----------|
| authority | 3 | Official docs, the project's maintainers, a recognized expert | Anonymous or content-farm page |
| recency | 2 | Under 6 months old, or matches the current release | Older than 3 years on a fast-moving topic |
| depth | 2 | Covers the subject thoroughly | A fragment or a teaser |
| examples | 2 | Several working code examples | None |
| uniqueness | 1 | A view the other sources do not give | Duplicates another source |

`qualityScore` is the weighted sum, 0 to 100: `3*authority + 2*recency + 2*depth + 2*examples + uniqueness`.

Rank from search metadata (title, snippet, URL, date) before fetching, then correct the scores once you have read the page. Take the top N, where N is the depth target, and keep the type mix varied: a guide built from five blog posts that all paraphrase the same doc page has one source, not five.

For stable topics (algorithms, language fundamentals) recency matters less; say so in the guide rather than dropping a canonical older source.

## Per-source record

Kept in memory while researching and written to `resources/{slug}-sources.json` (layout in [templates.md](templates.md)).

```json
{
  "url": "https://...",
  "title": "...",
  "type": "officialDocs",
  "qualityScore": 85,
  "scores": { "authority": 9, "recency": 8, "depth": 7, "examples": 9, "uniqueness": 6 },
  "keyInsights": ["...", "..."],
  "codeExamples": [{ "language": "javascript", "description": "basic usage" }],
  "extractedAt": "<ISO 8601 timestamp>"
}
```

`type` is one of `officialDocs`, `tutorials`, `stackOverflow`, `blogPosts`, `github`, and feeds `sourceBreakdown` in the result.
