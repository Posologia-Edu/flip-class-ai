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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    // Verify caller is admin
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    
    // Check admin role
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin");
    
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "invite") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(JSON.stringify({ error: "Email inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already invited
      const { data: existing } = await adminClient
        .from("admin_invites")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      
      if (existing) {
        return new Response(JSON.stringify({ error: "Este email já foi convidado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Invite user via Supabase Auth (sends password setup email)
      // redirectTo sends invited user to the set-password page
      const siteUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "") || "";
      const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { invited_by_admin: true },
        redirectTo: `${req.headers.get("origin") || "https://learn-flip-ai-25.lovable.app"}/reset-password`,
      });

      if (inviteErr) {
        // If user already exists, send password reset instead
        if (inviteErr.message?.includes("already been registered") || inviteErr.message?.includes("already exists")) {
          await adminClient.auth.admin.generateLink({
            type: "recovery",
            email,
          });
        } else {
          throw inviteErr;
        }
      }

      // Record the invite
      await adminClient.from("admin_invites").insert({
        email,
        invited_by: userData.user.id,
        status: "pending",
      });

      // If a new user was created, auto-approve their profile
      if (inviteData?.user) {
        // Create profile as approved
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
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get invite details
      const { data: invite } = await adminClient
        .from("admin_invites")
        .select("*")
        .eq("id", inviteId)
        .maybeSingle();

      if (!invite) {
        return new Response(JSON.stringify({ error: "Convite não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete the invite record
      await adminClient.from("admin_invites").delete().eq("id", inviteId);

      // Try to delete the auth user if they haven't activated yet
      if (invite.status !== "active") {
        const { data: allUsers } = await adminClient.auth.admin.listUsers();
        const matchedUser = allUsers?.users?.find((u: any) => u.email === invite.email);
        if (matchedUser && !matchedUser.last_sign_in_at) {
          await adminClient.auth.admin.deleteUser(matchedUser.id);
          // Also clean up profile
          await adminClient.from("profiles").delete().eq("user_id", matchedUser.id);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_invites") {
      const { data: invites } = await adminClient
        .from("admin_invites")
        .select("*")
        .order("created_at", { ascending: false });

      // Check activation status for each invite
      const enriched = [];
      for (const inv of invites || []) {
        // Check if user exists and has logged in
        const { data: users } = await adminClient.auth.admin.listUsers({ perPage: 1, page: 1 });
        let isActive = false;
        
        // Check if profile exists with approved status
        const { data: profile } = await adminClient
          .from("profiles")
          .select("approval_status, user_id")
          .eq("user_id", (await adminClient.auth.admin.listUsers()).data?.users?.find((u: any) => u.email === inv.email)?.id ?? "")
          .maybeSingle();
        
        if (profile && profile.approval_status === "approved") {
          // Check if user has confirmed email (logged in at least once)
          const matchedUser = (await adminClient.auth.admin.listUsers()).data?.users?.find((u: any) => u.email === inv.email);
          isActive = matchedUser?.email_confirmed_at != null && matchedUser?.last_sign_in_at != null;
        }

        // Update status if changed
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
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
