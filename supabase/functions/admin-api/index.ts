import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const allowedOrigins = new Set([
  "https://nishiosxn.github.io",
]);
function isAllowedOrigin(origin) {
  return allowedOrigins.has(origin) || /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
}

function corsHeaders(req) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://nishiosxn.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase runtime configuration");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

async function requireAdmin(req) {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return { error: "Authentication required", status: 401 };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { error: "Invalid session", status: 401 };

  const { data: role, error: roleError } = await admin
    .from("app_admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (roleError) throw roleError;
  if (!role) return { error: "Administrator role required", status: 403 };
  return { user: data.user };
}

async function listOverview(page) {
  const perPage = 100;
  const [usersResult, householdsResult, membersResult, adminsResult, categoriesResult, transactionsResult, recurrencesResult] = await Promise.all([
    admin.auth.admin.listUsers({ page, perPage }),
    admin.from("households").select("id,name,created_by,created_at,updated_at"),
    admin.from("household_members").select("household_id,user_id,display_name,role,slot,joined_at"),
    admin.from("app_admins").select("user_id,created_at,created_by"),
    admin.from("categories").select("household_id"),
    admin.from("transactions").select("household_id,archived_at"),
    admin.from("recurrences").select("household_id,archived_at"),
  ]);
  const firstError = usersResult.error || householdsResult.error || membersResult.error || adminsResult.error || categoriesResult.error || transactionsResult.error || recurrencesResult.error;
  if (firstError) throw firstError;

  const admins = new Set((adminsResult.data || []).map((row) => row.user_id));
  const members = membersResult.data || [];
  const countByHousehold = (rows, activeOnly = false) => {
    const counts = {};
    for (const row of rows) {
      if (activeOnly && row.archived_at) continue;
      counts[row.household_id] = (counts[row.household_id] || 0) + 1;
    }
    return counts;
  };
  const categoryCounts = countByHousehold(categoriesResult.data || []);
  const transactionCounts = countByHousehold(transactionsResult.data || [], true);
  const recurrenceCounts = countByHousehold(recurrencesResult.data || [], true);

  return {
    page,
    perPage,
    users: (usersResult.data.users || []).map((user) => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      email_confirmed_at: user.email_confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      banned_until: user.banned_until,
      disabled: Boolean(user.banned_until && new Date(user.banned_until).getTime() > Date.now()),
      is_admin: admins.has(user.id),
      memberships: members.filter((member) => member.user_id === user.id),
    })),
    households: (householdsResult.data || []).map((household) => ({
      ...household,
      members: members.filter((member) => member.household_id === household.id),
      category_count: categoryCounts[household.id] || 0,
      transaction_count: transactionCounts[household.id] || 0,
      recurrence_count: recurrenceCounts[household.id] || 0,
    })),
  };
}

async function assertMutableUser(actorId, targetId) {
  if (targetId === actorId) throw new Error("You cannot modify your own administrator account");
  const { data, error } = await admin.from("app_admins").select("user_id").eq("user_id", targetId).maybeSingle();
  if (error) throw error;
  if (data) throw new Error("Another administrator account cannot be modified here");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin");
  if (origin && !isAllowedOrigin(origin)) return json(req, { error: "Origin not allowed" }, 403);

  try {
    const access = await requireAdmin(req);
    if ("error" in access) return json(req, { error: access.error }, access.status);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list");

    if (action === "list") {
      const page = Math.max(1, Math.min(1000, Number(body.page) || 1));
      return json(req, await listOverview(page));
    }

    if (action === "set_user_disabled") {
      if (!isUuid(body.user_id) || typeof body.disabled !== "boolean") return json(req, { error: "Invalid request" }, 400);
      await assertMutableUser(access.user.id, body.user_id);
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { ban_duration: body.disabled ? "876000h" : "none" });
      if (error) throw error;
      await admin.from("admin_audit_log").insert({ actor_user_id: access.user.id, action: body.disabled ? "user_disabled" : "user_enabled", target_user_id: body.user_id });
      return json(req, { ok: true });
    }

    if (action === "delete_user") {
      if (!isUuid(body.user_id)) return json(req, { error: "Invalid user" }, 400);
      await assertMutableUser(access.user.id, body.user_id);
      const { data: owned, error: ownedError } = await admin.from("households").select("id").eq("created_by", body.user_id);
      if (ownedError) throw ownedError;
      const ownedIds = (owned || []).map((row) => row.id);
      if (ownedIds.length) {
        const { error } = await admin.from("households").delete().in("id", ownedIds);
        if (error) throw error;
      }
      const { error } = await admin.auth.admin.deleteUser(body.user_id, false);
      if (error) throw error;
      await admin.from("admin_audit_log").insert({ actor_user_id: access.user.id, action: "user_deleted", details: { deleted_user_id: body.user_id, deleted_household_ids: ownedIds } });
      return json(req, { ok: true });
    }

    if (action === "delete_household") {
      if (!isUuid(body.household_id)) return json(req, { error: "Invalid household" }, 400);
      const { error } = await admin.from("households").delete().eq("id", body.household_id);
      if (error) throw error;
      await admin.from("admin_audit_log").insert({ actor_user_id: access.user.id, action: "household_deleted", details: { deleted_household_id: body.household_id } });
      return json(req, { ok: true });
    }

    return json(req, { error: "Unknown action" }, 400);
  } catch (error) {
    console.error("admin-api", error);
    return json(req, { error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
