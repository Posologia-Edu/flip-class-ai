interface AiCallOptions {
  model?: string;
  messages: Array<{ role: string; content: any }>;
  signal?: AbortSignal;
  customProviderKeys?: Partial<Record<string, string>>;
}

export async function getCustomProviderKeys(serviceSupabase: any): Promise<Record<string, string>> {
  try {
    const { data, error } = await serviceSupabase
      .from("ai_api_keys")
      .select("provider, api_key");

    if (error || !data) {
      console.warn("Failed to load custom AI keys from database:", error?.message);
      return {};
    }

    return data.reduce((acc: Record<string, string>, row: { provider: string; api_key: string }) => {
      if (row.provider && row.api_key) acc[row.provider] = row.api_key;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export interface AiCallResult {
  content: string;
  provider: string;
  model: string;
  tokens_input: number;
  tokens_output: number;
}

const PROVIDER_CONFIG: Record<string, { baseUrl: string; defaultModel: string; format: "openai" | "anthropic"; envKey: string }> = {
  groq: { baseUrl: "https://api.groq.com/openai/v1/chat/completions", defaultModel: "llama-3.3-70b-versatile", format: "openai", envKey: "AI_KEY_GROQ" },
  openai: { baseUrl: "https://api.openai.com/v1/chat/completions", defaultModel: "gpt-4o-mini", format: "openai", envKey: "AI_KEY_OPENAI" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1/chat/completions", defaultModel: "google/gemini-2.5-flash", format: "openai", envKey: "AI_KEY_OPENROUTER" },
  google: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", defaultModel: "gemini-2.5-flash", format: "openai", envKey: "AI_KEY_GOOGLE" },
  anthropic: { baseUrl: "https://api.anthropic.com/v1/messages", defaultModel: "claude-sonnet-4-20250514", format: "anthropic", envKey: "AI_KEY_ANTHROPIC" },
};

interface RawApiResult {
  content: string;
  tokens_input: number;
  tokens_output: number;
}

async function callAnthropicApi(apiKey: string, model: string, messages: Array<{ role: string; content: any }>, signal?: AbortSignal): Promise<RawApiResult> {
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
  return {
    content: data.content?.[0]?.text || "",
    tokens_input: data.usage?.input_tokens ?? 0,
    tokens_output: data.usage?.output_tokens ?? 0,
  };
}

async function callOpenAiCompatibleApi(baseUrl: string, apiKey: string, model: string, messages: Array<{ role: string; content: any }>, signal?: AbortSignal): Promise<RawApiResult> {
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
  return {
    content: data.choices?.[0]?.message?.content || "",
    tokens_input: data.usage?.prompt_tokens ?? 0,
    tokens_output: data.usage?.completion_tokens ?? 0,
  };
}

/** @deprecated Use callAiWithFallbackDetailed for new code */
export async function callAiWithFallback(options: AiCallOptions): Promise<string> {
  const result = await callAiWithFallbackDetailed(options);
  return result.content;
}

export async function callAiWithFallbackDetailed(options: AiCallOptions): Promise<AiCallResult> {
  const customKeys: Record<string, string> = {};
  for (const [providerId, config] of Object.entries(PROVIDER_CONFIG)) {
    const val = Deno.env.get(config.envKey);
    if (val) customKeys[providerId] = val;
  }

  for (const [providerId, apiKey] of Object.entries(options.customProviderKeys || {})) {
    if (apiKey) customKeys[providerId] = apiKey;
  }

  // Try custom providers first
  const providerOrder = ["google", "groq", "openai", "openrouter", "anthropic"];
  const availableProviders = providerOrder.filter((p) => customKeys[p]);

  for (const providerId of availableProviders) {
    const config = PROVIDER_CONFIG[providerId];
    if (!config) continue;

    try {
      console.log(`Trying custom AI provider: ${providerId}`);
      let raw: RawApiResult;

      if (config.format === "anthropic") {
        raw = await callAnthropicApi(customKeys[providerId], config.defaultModel, options.messages, options.signal);
      } else {
        raw = await callOpenAiCompatibleApi(config.baseUrl, customKeys[providerId], config.defaultModel, options.messages, options.signal);
      }

      if (raw.content && raw.content.length > 0) {
        console.log(`Success with custom provider: ${providerId}`);
        return {
          content: raw.content,
          provider: providerId,
          model: config.defaultModel,
          tokens_input: raw.tokens_input,
          tokens_output: raw.tokens_output,
        };
      }
    } catch (err) {
      console.warn(`Custom provider ${providerId} failed:`, err.message);
    }
  }

  // Fallback to Lovable AI
  console.log("Falling back to Lovable AI gateway");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured and no custom AI keys available");

  const modelName = options.model || "google/gemini-2.5-flash";

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
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

  return {
    content,
    provider: "lovable",
    model: modelName,
    tokens_input: data.usage?.prompt_tokens ?? 0,
    tokens_output: data.usage?.completion_tokens ?? 0,
  };
}
