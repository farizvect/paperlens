import { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

interface ChatRequestBody {
  message: string;
  context?: { docName: string; chunkIndex: number; text: string; page?: number; section?: string }[];
  history?: { role: string; content: string }[];
  // BYOK overrides (optional)
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

// Server defaults (from .env)
const DEFAULT_BASE = process.env.LLM_BASE_URL || "https://token-plan-sgp.xiaomimimo.com/v1";
const DEFAULT_MODEL = process.env.LLM_MODEL || "mimo-v2.5-pro";
const DEFAULT_KEY = process.env.LLM_API_KEY || process.env.MIMO_API_KEY;

// SSRF protection — block private/internal IPs
const BLOCKED_HOSTS = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|::1|0:0:0:0:0:0:0:1|\[::1\])$/i;
const BLOCKED_PATTERNS = [/metadata\.google\.internal/i, /169\.254\.169\.254/i];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow https (no http, file:, data:, etc.)
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname;
    // Block private/internal hosts
    if (BLOCKED_HOSTS.test(hostname)) return false;
    if (BLOCKED_PATTERNS.some((p) => p.test(hostname))) return false;
    // Block IP-literal IPv6 private ranges (fc/fd/fe80)
    if (/^\[?(fc|fd|fe80):/i.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { message, context, history, baseUrl, apiKey, model } = body;

  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (message.length > 10000) {
    return new Response(JSON.stringify({ error: "Message too long (max 10000 chars)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate array sizes
  if (context && (!Array.isArray(context) || context.length > 20)) {
    return new Response(JSON.stringify({ error: "Context array too large (max 20)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (history && (!Array.isArray(history) || history.length > 30)) {
    return new Response(JSON.stringify({ error: "History array too large (max 30)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: `Rate limit exceeded. Try again in ${rl.retryAfter}s.` }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(rl.retryAfter) } }
    );
  }

  // SSRF: validate baseUrl before use
  let resolvedBase = DEFAULT_BASE;
  if (baseUrl) {
    if (!isAllowedUrl(baseUrl)) {
      return new Response(
        JSON.stringify({ error: "Invalid base URL. Must be https and not a private/internal address." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    resolvedBase = baseUrl;
  }
  const resolvedKey = apiKey || DEFAULT_KEY;
  const resolvedModel = model || DEFAULT_MODEL;

  if (!resolvedKey) {
    return new Response(
      JSON.stringify({ error: "No API key configured. Set one in Settings or configure LLM_API_KEY in .env" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build context from client-provided chunks
  const contextParts = (context ?? []).map(
    (r, i) => {
      const meta = [`from "${r.docName}"`];
      if (r.page) meta.push(`p.${r.page}`);
      if (r.section) meta.push(r.section);
      meta.push(`chunk ${r.chunkIndex}`);
      return `[Source ${i + 1}] (${meta.join(", ")}):\n${r.text}`;
    }
  );
  const contextStr = contextParts.join("\n\n");

  const systemMsg = contextStr
    ? `You are a helpful research assistant. Answer questions using the provided context from PDF document(s). Cite sources using [Source N] notation. If the context doesn't contain the answer, say so.

IMPORTANT RULES:
1. Detect the language of the PDF document from the context and respond in that same language.
2. When citing multiple sources, always write each separately: [Source 1] [Source 2] — never combine like [Source 1, 2].
3. Every factual claim must have a citation.

After your complete answer, suggest 2-3 relevant follow-up questions the user might want to ask. Output them inside a <suggestions> XML tag as a JSON array of strings. Example:
<suggestions>["What is the sample size used?", "How does this compare to previous studies?", "What are the practical implications?"]</suggestions>

Context:
${contextStr}`
    : `You are a helpful research assistant. Answer questions clearly and concisely. Match the language of the user's question.

After your complete answer, suggest 2-3 relevant follow-up questions the user might want to ask. Output them inside a <suggestions> XML tag as a JSON array of strings. Example:
<suggestions>["What is the sample size used?", "How does this compare to previous studies?", "What are the practical implications?"]</suggestions>`;

  const messages = [
    { role: "system", content: systemMsg },
    ...(history ?? []),
    { role: "user", content: message },
  ];

  const endpoint = `${resolvedBase.replace(/\/+$/, "")}/chat/completions`;

  let llmResponse: Response | null = null;
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      llmResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resolvedKey}`,
        },
          body: JSON.stringify({
            model: resolvedModel,
            messages,
            stream: true,
            stream_options: { include_usage: true },
          }),
        signal: AbortSignal.timeout(120_000),
      });
      break;
    } catch (err) {
      if (attempt === maxRetries) {
        console.error("LLM API failed after retries:", err);
        const detail = err instanceof Error ? err.message : "unknown error";
        return new Response(
          JSON.stringify({ error: `AI service unreachable: ${detail}` }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  if (llmResponse === null) {
    return new Response(
      JSON.stringify({ error: "LLM service unavailable" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = llmResponse;

  if (!response.ok) {
    const errText = await response.text();
    console.error("LLM API error:", errText);
    return new Response(JSON.stringify({ error: `LLM request failed: ${response.status}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      let sourcesSent = false;
      let accumulatedContent = "";
      let tokenUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data) as {
                choices?: { delta?: { content?: string } }[];
                usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
              };

              // Capture usage from final chunk (stream_options.include_usage)
              if (parsed.usage && parsed.usage.total_tokens) {
                tokenUsage = parsed.usage;
              }

              const content = parsed.choices?.[0]?.delta?.content;

              // Send sources first
              if (!sourcesSent && content && context && context.length > 0) {
                const sourcesPayload = JSON.stringify({
                  type: "sources",
                  sources: context.map((r, i) => ({
                    index: i + 1,
                    docName: r.docName,
                    chunkIndex: r.chunkIndex,
                    text: r.text,
                    page: r.page,
                    section: r.section,
                  })),
                });
                controller.enqueue(
                  encoder.encode(`data: ${sourcesPayload}\n\n`)
                );
                sourcesSent = true;
              }

              if (content) {
                accumulatedContent += content;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "content", content })}\n\n`
                  )
                );
              }
            } catch {
              // skip malformed JSON lines
            }
          }
        }

        // After stream is complete, parse suggestions from accumulated content
        const suggestionsMatch = accumulatedContent.match(
          /<(?:suggestions|follow_up_questions|follow-up-questions)>\s*(\[[\s\S]*?\])\s*<\/(?:suggestions|follow_up_questions|follow-up-questions)>/
        );
        if (suggestionsMatch) {
          try {
            const suggestions = JSON.parse(suggestionsMatch[1]);
            if (Array.isArray(suggestions) && suggestions.length > 0) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "suggestions", suggestions })}\n\n`
                )
              );
            }
          } catch {
            // Invalid JSON in suggestions tag — skip
          }
        }
      } finally {
        // Send token usage before done
        if (tokenUsage) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "usage", usage: tokenUsage })}\n\n`)
          );
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
