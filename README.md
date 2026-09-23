# agent-wire

Turn prompts, remote MCP connectors, and `SKILL.md` rules into curlable serverless agent endpoints.

```bash
git clone https://github.com/hemanth/agent-wire.git
cd agent-wire
npm install
npm run server
```

## Quick start

Deploy an agent via curl or the web studio:

```bash
curl -X POST http://localhost:8787/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Design Critic",
    "slug": "design-critic",
    "systemPrompt": "Enforce high craft and contrast on proposed UI.",
    "models": ["anthropic/claude-3.5-sonnet", "meta-llama/llama-3.3-70b-instruct"],
    "mcps": [{
      "id": "stitch",
      "name": "Stitch MCP",
      "url": "https://stitch.googleapis.com/mcp",
      "type": "http"
    }],
    "skills": [{
      "id": "taste-skill",
      "name": "Taste Skill",
      "content": "Verify contrast >= 4.5:1. No gradient text. No nested cards."
    }]
  }'
```

Returns an agent object with a permanent, curlable endpoint `id`.

## Run task

```bash
curl -X POST http://localhost:8787/api/agents/agt_design_critic/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d '{"prompt": "Audit this hero section: <button class=\"bg-blue-500 text-white\">Click</button>"}'
```

`POST /api/agents/:id/run` probes remote MCP tools, injects skills, loops tool calls, and returns JSON or SSE traces.

## OpenRouter model failover

```json
{
  "models": [
    "anthropic/claude-3.5-sonnet",
    "google/gemini-2.5-flash",
    "meta-llama/llama-3.3-70b-instruct"
  ]
}
```

Pass an ordered array of models. OpenRouter automatically fails over to the next candidate if the primary is rate-limited or unavailable.

## Deploy to Cloudflare

```bash
npm run deploy
```

`wrangler deploy` publishes the edge worker and serves the studio static assets via Cloudflare Workers.

## License

MIT © [Hemanth.HM](https://h3manth.com)
