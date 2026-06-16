import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallbackDetailed, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-student-token",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(url, service);

    const { roomId, topic, transcript, studentName, studentEmail, durationSec } = await req.json();
    if (!roomId || !Array.isArray(transcript) || transcript.length < 2) return json({ error: "Transcript insuficiente" }, 400);

    const dialog = transcript.map((t: any) => `${t.role === "examiner" ? "EXAMINADOR" : "ALUNO"}: ${t.text}`).join("\n");

    const customKeys = await getCustomProviderKeys(svc);
    const result = await callAiWithFallbackDetailed({
      messages: [
        { role: "system", content: `Você avalia um debate socrático sobre "${topic}". Gere uma rubrica de RACIOCÍNIO CLÍNICO em JSON estrito (sem markdown):
{
  "rubric": {
    "clinical_reasoning": <0-10>,
    "evidence_use": <0-10>,
    "clarity": <0-10>,
    "depth": <0-10>
  },
  "final_grade": <0-10 média ponderada>,
  "feedback_md": "<feedback em markdown, 3-6 frases, com pontos fortes e a melhorar>"
}` },
        { role: "user", content: dialog.slice(0, 30000) },
      ],
      customProviderKeys: customKeys,
    });

    let parsed: any = {};
    try {
      const raw = result.content.trim().replace(/^```json\s*|\s*```$/g, "");
      parsed = JSON.parse(raw);
    } catch {
      parsed = { rubric: { clinical_reasoning: 5, evidence_use: 5, clarity: 5, depth: 5 }, final_grade: 5, feedback_md: result.content.slice(0, 1000) };
    }

    const { data: row, error } = await svc.from("socratic_sessions").insert({
      room_id: roomId,
      student_email: (studentEmail || "anonimo@anon").toLowerCase(),
      student_name: studentName || null,
      topic,
      transcript,
      rubric: parsed.rubric,
      final_grade: parsed.final_grade,
      feedback_md: parsed.feedback_md,
      duration_sec: durationSec || 0,
      ended_at: new Date().toISOString(),
    }).select().single();
    if (error) console.warn("insert socratic", error.message);

    return json({ success: true, session: row, rubric: parsed.rubric, final_grade: parsed.final_grade, feedback_md: parsed.feedback_md });
  } catch (e: any) {
    console.error("socratic-end", e);
    return json({ error: e.message || "Erro" }, 500);
  }
});
