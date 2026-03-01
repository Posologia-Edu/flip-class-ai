import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        return new Response(JSON.stringify({ error: "sessionId is required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const [sessRes, logsRes, feedbackRes] = await Promise.all([
        supabase.from("student_sessions").select("*").eq("id", sessionId).single(),
        supabase.from("student_activity_logs").select("*").eq("session_id", sessionId),
        supabase.from("teacher_feedback").select("*").eq("session_id", sessionId),
      ]);

      if (sessRes.error || !sessRes.data) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }

      return new Response(JSON.stringify({
        session: sessRes.data,
        activityLogs: logsRes.data || [],
        teacherFeedbacks: feedbackRes.data || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { action, sessionId, roomId, data } = body;

      if (action === "create_session") {
        if (!roomId || typeof roomId !== "string") {
          return new Response(JSON.stringify({ error: "roomId is required" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }
        const name = typeof data?.student_name === "string" ? data.student_name.trim() : "";
        const email = typeof data?.student_email === "string" ? data.student_email.trim().toLowerCase() : "";

        if (name.length < 2 || name.length > 100) {
          return new Response(JSON.stringify({ error: "Nome deve ter entre 2 e 100 caracteres" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }
        const sanitizedName = name.replace(/<[^>]*>/g, "");

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
          return new Response(JSON.stringify({ error: "Email inválido" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }

        // Verify room exists and get teacher_id
        const { data: room, error: roomErr } = await supabase
          .from("rooms").select("id, teacher_id").eq("id", roomId).single();
        if (roomErr || !room) {
          return new Response(JSON.stringify({ error: "Sala não encontrada" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404,
          });
        }

        // Determine teacher's plan (admin invite + Stripe)
        const planLimits: Record<string, number> = { free: 30, professor: 60, institutional: -1 };
        const planHierarchy: Record<string, number> = { free: 0, professor: 1, institutional: 2 };
        const productToPlan: Record<string, string> = {
          "prod_U1yOTsueyuc6SQ": "professor",
          "prod_U1yOWsVEIi6joe": "institutional",
        };

        let adminPlan = "free";
        let stripePlan = "free";
        let teacherEmail = "";

        try {
          const { data: teacherAuth } = await supabase.auth.admin.getUserById(room.teacher_id);
          teacherEmail = teacherAuth?.user?.email?.toLowerCase() || "";
          
          if (teacherEmail) {
            // Check admin invite
            const { data: invite } = await supabase
              .from("admin_invites")
              .select("granted_plan, status")
              .eq("email", teacherEmail)
              .in("status", ["active", "pending"])
              .maybeSingle();
            if (invite?.granted_plan && invite.granted_plan in planLimits) {
              adminPlan = invite.granted_plan;
            }

            // Check Stripe subscription using direct fetch
            const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
            if (stripeKey) {
              const stripeGet = async (path: string) => {
                const res = await fetch(`https://api.stripe.com/v1${path}`, {
                  headers: { "Authorization": `Bearer ${stripeKey}` },
                });
                if (!res.ok) throw new Error(`Stripe error ${res.status}`);
                return res.json();
              };
              const customers = await stripeGet(`/customers?email=${encodeURIComponent(teacherEmail)}&limit=1`);
              if (customers.data.length > 0) {
                const customerId = customers.data[0].id;
                const [activeSubs, trialingSubs] = await Promise.all([
                  stripeGet(`/subscriptions?customer=${customerId}&status=active&limit=1`),
                  stripeGet(`/subscriptions?customer=${customerId}&status=trialing&limit=1`),
                ]);
                const sub = activeSubs.data[0] || trialingSubs.data[0];
                if (sub) {
                  const productId = String(sub.items.data[0].price.product);
                  stripePlan = productToPlan[productId] || "free";
                }
              }
            }
          }
        } catch {
          // ignore - use defaults
        }

        const teacherPlan = (planHierarchy[adminPlan] ?? 0) >= (planHierarchy[stripePlan] ?? 0) ? adminPlan : stripePlan;

        // Get current unique student count for this room
        const { count: currentStudentCount } = await supabase
          .from("student_sessions")
          .select("student_email", { count: "exact", head: true })
          .eq("room_id", roomId);

        const maxStudents = planLimits[teacherPlan] ?? 30;
        if (maxStudents !== -1 && (currentStudentCount ?? 0) >= maxStudents) {
          return new Response(JSON.stringify({ 
            error: `Esta sala atingiu o limite de ${maxStudents} alunos do plano do professor. Solicite ao professor para fazer upgrade.` 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 403,
          });
        }

        // Check if room has a student whitelist
        const { data: whitelist } = await supabase
          .from("room_students")
          .select("id")
          .eq("room_id", roomId);
        
        if (whitelist && whitelist.length > 0) {
          // Room has a whitelist - check if student email is registered
          const { data: allowed } = await supabase
            .from("room_students")
            .select("id")
            .eq("room_id", roomId)
            .eq("student_email", email)
            .maybeSingle();
          
          if (!allowed) {
            return new Response(JSON.stringify({ error: "Seu email não está cadastrado nesta sala. Solicite ao professor para adicionar seu email." }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 403,
            });
          }
        }

        const { data: session, error: insertErr } = await supabase
          .from("student_sessions")
          .insert({
            room_id: roomId,
            student_name: sanitizedName,
            student_email: email,
          })
          .select("id")
          .single();

        if (insertErr) throw insertErr;

        return new Response(JSON.stringify({ sessionId: session.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!sessionId) {
        return new Response(JSON.stringify({ error: "sessionId is required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      if (action === "submit") {
        const { data: existing } = await supabase
          .from("student_sessions")
          .select("completed_at")
          .eq("id", sessionId)
          .single();

        if (existing?.completed_at) {
          return new Response(JSON.stringify({ error: "Session already completed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }

        const { error } = await supabase.from("student_sessions").update({
          score: data.score,
          answers: data.answers,
          completed_at: new Date().toISOString(),
        }).eq("id", sessionId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "log_activity") {
        const { error } = await supabase.from("student_activity_logs").insert({
          session_id: sessionId,
          room_id: roomId,
          activity_type: data.activity_type,
          material_id: data.material_id || null,
          duration_seconds: data.duration_seconds || 0,
        });

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
