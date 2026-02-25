import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface AiCallOptions {
  model?: string;
  messages: Array<{ role: string; content: any }>;
  signal?: AbortSignal;
}

interface AiProvider {
  id: string;
  apiKey: string;
  baseUrl: string;
  model?: string;
}

const PROVIDER_CONFIG: Record<string, { baseUrl: string; defaultModel: string; format: "openai" | "anthropic" }> = {
  groq: { baseUrl: "https://api.groq.com/openai/v1/chat/completions", defaultModel: "llama-3.3-70b-versatile", format: "openai" },
  openai: { baseUrl: "https://api.openai.com/v1/chat/completions", defaultModel: "gpt-4o-mini", format: "openai" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1/chat/completions", defaultModel: "google/gemini-2.5-flash", format: "openai" },
  google: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", defaultModel: "gemini-2.5-flash", format: "openai" },
  anthropic: { baseUrl: "https://api.anthropic.com/v1/messages", defaultModel: "claude-sonnet-4-20250514", format: "anthropic" },
};

async function callAnthropicApi(apiKey: string, model: string, messages: Array<{ role: string; content: any }>, signal?: AbortSignal): Promise<string> {
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystemMsgs = messages.filter((m) => m.role !== "system");

  const body: any = {
    model,
    max_tokens: 4096,
    messages: nonSystemMsgs,
  };
  if (systemMsg) body.system = systemMsg.content;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${t}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

async function callOpenAiCompatibleApi(baseUrl: string, apiKey: string, model: string, messages: Array<{ role: string; content: any }>, signal?: AbortSignal): Promise<string> {
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
    signal,
  });

  if (!response.ok) {
    const t = await response.text();
    throw new Error(`API error ${response.status}: ${t}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function callAiWithFallback(options: AiCallOptions): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch custom API keys
  const { data: apiKeys } = await supabase.from("ai_api_keys").select("provider, api_key");
  const customKeys = (apiKeys || []).reduce((acc: Record<string, string>, k: any) => {
    acc[k.provider] = k.api_key;
    return acc;
  }, {});

  // Try custom providers first
  const providerOrder = ["groq", "openai", "openrouter", "google", "anthropic"];
  const availableProviders = providerOrder.filter((p) => customKeys[p]);

  for (const providerId of availableProviders) {
    const config = PROVIDER_CONFIG[providerId];
    if (!config) continue;

    try {
      console.log(`Trying custom AI provider: ${providerId}`);
      let result: string;

      if (config.format === "anthropic") {
        result = await callAnthropicApi(customKeys[providerId], config.defaultModel, options.messages, options.signal);
      } else {
        result = await callOpenAiCompatibleApi(config.baseUrl, customKeys[providerId], config.defaultModel, options.messages, options.signal);
      }

      if (result && result.length > 0) {
        console.log(`Success with custom provider: ${providerId}`);
        return result;
      }
    } catch (err) {
      console.warn(`Custom provider ${providerId} failed:`, err.message);
      // Continue to next provider
    }
  }

  // Fallback to Lovable AI
  console.log("Falling back to Lovable AI gateway");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured and no custom AI keys available");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model || "google/gemini-2.5-flash",
      messages: options.messages,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("INSUFFICIENT_CREDITS");
    const t = await response.text();
    console.error("Lovable AI gateway error:", response.status, t);
    throw new Error("Erro no serviço de IA");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Sem resposta da IA");
  return content;
}
