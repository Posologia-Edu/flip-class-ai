import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallbackDetailed, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Auth required" }, 401);
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return json({ error: "Invalid auth" }, 401);

    const { roomId, topic, numStations = 4, stationTypes } = await req.json();
    if (!roomId || !topic) return json({ error: "roomId e topic obrigatórios" }, 400);

    const svc = createClient(url, service);
    const { data: room } = await svc.from("rooms").select("teacher_id").eq("id", roomId).single();
    const { data: isCollab } = await svc.rpc("is_room_collaborator", { _room_id: roomId, _user_id: user.id });
    if (!room || (room.teacher_id !== user.id && !isCollab)) return json({ error: "Sem acesso" }, 403);

    const { data: mats } = await svc.from("materials").select("title, transcript_text, description").eq("room_id", roomId).limit(15);
    let ctx = "";
    let used = 0;
    for (const m of (mats || [])) {
      const p = `### ${m.title}\n${(m.transcript_text || m.description || "").slice(0, 3000)}\n\n`;
      if (used + p.length > 25000) break;
      ctx += p; used += p.length;
    }

    const allowedTypes = (stationTypes && Array.isArray(stationTypes) && stationTypes.length) ? stationTypes : ["anamnese", "prescricao", "comunicacao", "calculo", "raciocinio"];

    const customKeys = await getCustomProviderKeys(svc);
    const result = await callAiWithFallbackDetailed({
      messages: [
        { role: "system", content: `Você cria um OSCE (Exame Clínico Objetivo Estruturado) virtual em farmácia/saúde. Gere ${numStations} estações sobre "${topic}", uma de cada tipo entre: ${allowedTypes.join(", ")}.

Cada estação tem:
- type: um dos tipos acima
- title: nome curto
- prompt: instrução completa para o aluno (situação clínica realista, dados do paciente, tarefa específica)
- duration_sec: 180-420
- max_score: 10
- rubric_criteria: array com 3-5 critérios objetivos avaliáveis (ex: "Identifica reação adversa", "Calcula dose corretamente"), cada um com weight (soma=10).

Responda APENAS JSON estrito (sem markdown):
{"stations":[{"id":"s1","type":"...","title":"...","prompt":"...","duration_sec":300,"max_score":10,"rubric_criteria":[{"criterion":"...","weight":3.5}]}]}` },
        { role: "user", content: `Materiais da sala (use para contextualizar):\n${ctx || "(sem materiais)"}\n\nTópico: ${topic}` },
      ],
      customProviderKeys: customKeys,
    });

    let stations: any[] = [];
    try {
      const raw = result.content.trim().replace(/^```json\s*|\s*```$/g, "");
      const parsed = JSON.parse(raw);
      stations = parsed.stations || [];
    } catch (e) {
      return json({ error: "IA não retornou JSON válido", raw: result.content.slice(0, 500) }, 502);
    }

    return json({ success: true, stations });
  } catch (e: any) {
    console.error("osce-generate", e);
    return json({ error: e.message || "Erro" }, 500);
  }
});
