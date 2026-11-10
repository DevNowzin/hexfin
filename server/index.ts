import { createServer } from 'node:http';
import { createAnthropicClient, requestCategorySuggestion, requestInsights } from '../src/features/ai/anthropic.ts';
import { createRequestHandler } from './app.ts';
import { loadConfig } from './config.ts';

function main() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(`[server] configuração inválida: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const client = createAnthropicClient({
    apiKey: config.aiApiKey,
    baseURL: config.aiBaseUrl,
    timeoutMs: config.aiTimeoutMs,
  });
  const handler = createRequestHandler({
    config,
    categorize: (request, signal) => requestCategorySuggestion(client, config.aiModel, request, signal),
    insights: (request, signal) => requestInsights(client, config.aiModel, request, signal),
  });

  const server = createServer((req, res) => void handler(req, res));
  server.requestTimeout = config.aiTimeoutMs + 5000;
  server.listen(config.port, config.host, () => {
    console.log(`[server] HexFin AI em http://${config.host}:${config.port} (modelo ${config.aiModel})`);
  });
}

main();
