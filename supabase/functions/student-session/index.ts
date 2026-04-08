import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// HMAC-based session token generation & verification
async function generateSessionToken(sessionId: string): Promise<string> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(sessionId));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[+/=]/g, (c) =>
    c === "+" ? "-" : c === "/" ? "_" : ""
  );
}

async function verifySessionToken(sessionId: string, token: string): Promise<boolean> {
  const expected = await generateSessionToken(sessionId);
  return expected === token;
}

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
      const token = url.searchParams.get("token");

      if (!sessionId) {
        return new Response(JSON.stringify({ error: "sessionId is required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // Validate session token to prevent enumeration
      if (!token || !(await verifySessionToken(sessionId, token))) {
        return new Response(JSON.stringify({ error: "Invalid or missing session token" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
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
      const { action, sessionId, roomId, data, token, mode } = body;

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

        // Verify room exists and get teacher_id + expiration info
        const { data: room, error: roomErr } = await supabase
          .from("rooms").select("id, teacher_id, expire_at, last_student_activity_at").eq("id", roomId).single();
        if (roomErr || !room) {
          return new Response(JSON.stringify({ error: "Sala não encontrada" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404,
          });
        }

        // Check if room is expired
        const now = new Date();
        const isExpiredByDate = room.expire_at && new Date(room.expire_at) < now;
        const isExpiredByIdle = room.last_student_activity_at && 
          (now.getTime() - new Date(room.last_student_activity_at).getTime()) > 7 * 24 * 60 * 60 * 1000;
        
        if (isExpiredByDate || isExpiredByIdle) {
          return new Response(JSON.stringify({ error: "Esta sala expirou e não está mais aceitando novos acessos." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 403,
          });
        }

        // Check if student already has a session in this room (same email)
        const { data: existingSession } = await supabase
          .from("student_sessions")
          .select("id")
          .eq("room_id", roomId)
          .eq("student_email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingSession) {
          const sessionToken = await generateSessionToken(existingSession.id);
          return new Response(JSON.stringify({ sessionId: existingSession.id, token: sessionToken }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
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
            const { data: invite } = await supabase
              .from("admin_invites")
              .select("granted_plan, status")
              .eq("email", teacherEmail)
              .in("status", ["active", "pending"])
              .maybeSingle();
            if (invite?.granted_plan && invite.granted_plan in planLimits) {
              adminPlan = invite.granted_plan;
            }

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

        // --- GROUP MODE ---
        if (mode === "group") {
          // Find the student in room_students
          const { data: roomStudent } = await supabase
            .from("room_students")
            .select("id")
            .eq("room_id", roomId)
            .eq("student_email", email)
            .maybeSingle();

          if (!roomStudent) {
            return new Response(JSON.stringify({ error: "Seu email não está cadastrado nesta sala." }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 403,
            });
          }

          // Find which group this student belongs to
          const { data: membership } = await supabase
            .from("room_group_members")
            .select("group_id, room_groups!inner(id, group_name)")
            .eq("student_id", roomStudent.id)
            .limit(1)
            .maybeSingle();

          if (!membership) {
            return new Response(JSON.stringify({ error: "Você não pertence a nenhum grupo nesta sala. Peça ao professor para adicioná-lo a um grupo." }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 403,
            });
          }

          const groupId = membership.group_id;

          // Check if there's already a leader session for this group in this room
          const { data: existingLeader } = await supabase
            .from("student_sessions")
            .select("id")
            .eq("room_id", roomId)
            .eq("group_id", groupId)
            .eq("is_group_leader", true)
            .maybeSingle();

          if (existingLeader) {
            // Return existing leader session (group already started)
            const leaderToken = await generateSessionToken(existingLeader.id);
            return new Response(JSON.stringify({ sessionId: existingLeader.id, token: leaderToken, groupId, groupName: (membership as any).room_groups?.group_name }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Get all members of this group
          const { data: allMembers } = await supabase
            .from("room_group_members")
            .select("student_id, room_students!inner(id, student_name, student_email)")
            .eq("group_id", groupId);

          if (!allMembers || allMembers.length === 0) {
            return new Response(JSON.stringify({ error: "Grupo sem membros." }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 400,
            });
          }

          // Create leader session
          const { data: leaderSession, error: leaderErr } = await supabase
            .from("student_sessions")
            .insert({
              room_id: roomId,
              student_name: sanitizedName,
              student_email: email,
              group_id: groupId,
              is_group_leader: true,
            })
            .select("id")
            .single();

          if (leaderErr) throw leaderErr;

          // Create sessions for other group members
          const otherMembers = allMembers.filter((m: any) => (m.room_students as any).student_email.toLowerCase() !== email);
          if (otherMembers.length > 0) {
            const memberInserts = otherMembers.map((m: any) => ({
              room_id: roomId,
              student_name: (m.room_students as any).student_name || (m.room_students as any).student_email,
              student_email: (m.room_students as any).student_email,
              group_id: groupId,
              is_group_leader: false,
            }));
            await supabase.from("student_sessions").insert(memberInserts);
          }

          const leaderToken = await generateSessionToken(leaderSession.id);
          return new Response(JSON.stringify({
            sessionId: leaderSession.id,
            token: leaderToken,
            groupId,
            groupName: (membership as any).room_groups?.group_name,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // --- INDIVIDUAL MODE (default) ---
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

        const sessionToken = await generateSessionToken(session.id);
        return new Response(JSON.stringify({ sessionId: session.id, token: sessionToken }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // get_peer_session: validates reviewer has an assignment to access reviewee session
      // get_signed_urls: generates signed URLs for private storage materials
      if (action === "get_signed_urls") {
        if (!sessionId || !token || !(await verifySessionToken(sessionId, token))) {
          return new Response(JSON.stringify({ error: "Invalid or missing session token" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403,
          });
        }
        const urls: string[] = data?.urls || [];
        const signedUrls: Record<string, string> = {};
        const storagePrefix = "/storage/v1/object/public/materials/";
        for (const url of urls) {
          const idx = url.indexOf(storagePrefix);
          if (idx === -1) { signedUrls[url] = url; continue; }
          const path = url.substring(idx + storagePrefix.length);
          try {
            const { data: signedData } = await supabase.storage.from("materials").createSignedUrl(path, 3600);
            signedUrls[url] = signedData?.signedUrl || url;
          } catch {
            signedUrls[url] = url;
          }
        }
        return new Response(JSON.stringify({ signedUrls }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "get_peer_session") {
        const revieweeSessionId = data?.reviewee_session_id;
        const reviewerSessionId = sessionId;
        if (!revieweeSessionId || !reviewerSessionId) {
          return new Response(JSON.stringify({ error: "Missing session IDs" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
          });
        }
        // Validate the reviewer token
        if (!token || !(await verifySessionToken(reviewerSessionId, token))) {
          return new Response(JSON.stringify({ error: "Invalid or missing session token" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403,
          });
        }
        // Check assignment exists
        const { data: assignment } = await supabase
          .from("peer_review_assignments")
          .select("id")
          .eq("reviewer_session_id", reviewerSessionId)
          .eq("reviewee_session_id", revieweeSessionId)
          .maybeSingle();
        if (!assignment) {
          return new Response(JSON.stringify({ error: "No valid peer review assignment" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403,
          });
        }
        const { data: revieweeSession } = await supabase
          .from("student_sessions").select("*").eq("id", revieweeSessionId).single();
        return new Response(JSON.stringify({ session: revieweeSession }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!sessionId) {
        return new Response(JSON.stringify({ error: "sessionId is required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // Validate token for all POST actions that modify session data
      if (!token || !(await verifySessionToken(sessionId, token))) {
        return new Response(JSON.stringify({ error: "Invalid or missing session token" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
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
