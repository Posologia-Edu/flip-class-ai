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

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    
    const { data: roles } = await adminClient
      .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin");
    
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "invite") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const grantedPlan = body.granted_plan || "institutional";
      
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(JSON.stringify({ error: "Email inválido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await adminClient.from("admin_invites").select("id").eq("email", email).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "Este email já foi convidado" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { invited_by_admin: true },
        redirectTo: `${req.headers.get("origin") || "https://learn-flip-ai-25.lovable.app"}/reset-password`,
      });

      if (inviteErr) {
        if (inviteErr.message?.includes("already been registered") || inviteErr.message?.includes("already exists")) {
          await adminClient.auth.admin.generateLink({ type: "recovery", email });
        } else {
          throw inviteErr;
        }
      }

      await adminClient.from("admin_invites").insert({
        email,
        invited_by: userData.user.id,
        status: "pending",
        granted_plan: grantedPlan,
      });

      if (inviteData?.user) {
        await adminClient.from("profiles").upsert({
          user_id: inviteData.user.id,
          full_name: "",
          approval_status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: userData.user.id,
        }, { onConflict: "user_id" });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "revoke_invite") {
      const inviteId = body.invite_id;
      if (!inviteId) {
        return new Response(JSON.stringify({ error: "invite_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: invite } = await adminClient.from("admin_invites").select("*").eq("id", inviteId).maybeSingle();
      if (!invite) {
        return new Response(JSON.stringify({ error: "Convite não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete the invite record
      await adminClient.from("admin_invites").delete().eq("id", inviteId);

      // Find the user by email
      const { data: allUsers } = await adminClient.auth.admin.listUsers();
      const matchedUser = allUsers?.users?.find((u: any) => u.email === invite.email);

      if (matchedUser) {
        if (invite.status === "active") {
          // Active user: reject their profile to block access
          await adminClient.from("profiles").update({ approval_status: "rejected" }).eq("user_id", matchedUser.id);
        } else {
          // Pending: delete user entirely
          if (!matchedUser.last_sign_in_at) {
            await adminClient.auth.admin.deleteUser(matchedUser.id);
            await adminClient.from("profiles").delete().eq("user_id", matchedUser.id);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_invites") {
      const { data: invites } = await adminClient.from("admin_invites").select("*").order("created_at", { ascending: false });

      const enriched = [];
      const { data: allUsersData } = await adminClient.auth.admin.listUsers();
      const allUsersList = allUsersData?.users || [];

      for (const inv of invites || []) {
        const matchedUser = allUsersList.find((u: any) => u.email === inv.email);
        let isActive = false;

        if (matchedUser) {
          const { data: profile } = await adminClient.from("profiles").select("approval_status")
            .eq("user_id", matchedUser.id).maybeSingle();
          isActive = profile?.approval_status === "approved" && !!matchedUser.email_confirmed_at && !!matchedUser.last_sign_in_at;
        }

        const newStatus = isActive ? "active" : "pending";
        if (inv.status !== newStatus) {
          await adminClient.from("admin_invites").update({ 
            status: newStatus,
            activated_at: isActive ? new Date().toISOString() : null,
          }).eq("id", inv.id);
        }

        enriched.push({ ...inv, status: newStatus });
      }

      return new Response(JSON.stringify({ invites: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
