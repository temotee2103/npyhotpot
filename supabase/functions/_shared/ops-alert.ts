import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type OpsAlertSeverity = "info" | "warning" | "critical";

export type OpsAlertPayload = {
  source: string;
  title: string;
  message: string;
  severity: OpsAlertSeverity;
  detail?: Record<string, unknown>;
};

const severityRank: Record<OpsAlertSeverity, number> = {
  info: 1,
  warning: 2,
  critical: 3,
};

async function getSetting(supabase: SupabaseClient, key: string) {
  const row = await supabase.from("official_runtime_settings").select("value").eq("key", key).maybeSingle();
  return String(row.data?.value ?? "").trim();
}

function buildAlertText(channelName: string, payload: OpsAlertPayload) {
  const lines = [
    `[${channelName}] ${payload.severity.toUpperCase()} · ${payload.title}`,
    payload.message,
    `source: ${payload.source}`,
    `time: ${new Date().toISOString()}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export async function sendOpsAlert(supabase: SupabaseClient, payload: OpsAlertPayload) {
  const enabled = (await getSetting(supabase, "ops_alert_enabled")).toLowerCase();
  if (!["true", "1", "yes", "on"].includes(enabled)) {
    return { ok: true, skipped: true, message: "alerting disabled" } as const;
  }

  const webhookUrl = await getSetting(supabase, "ops_alert_webhook_url");
  if (!webhookUrl) {
    return { ok: false, skipped: false, message: "ops_alert_webhook_url is missing" } as const;
  }

  const minSeverity = ((await getSetting(supabase, "ops_alert_min_severity")) || "warning").toLowerCase() as OpsAlertSeverity;
  if (severityRank[payload.severity] < severityRank[minSeverity]) {
    return { ok: true, skipped: true, message: "severity below threshold" } as const;
  }

  const channelName = (await getSetting(supabase, "ops_alert_channel_name")) || "Operations";
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: buildAlertText(channelName, payload),
      channel: channelName,
      severity: payload.severity,
      source: payload.source,
      title: payload.title,
      message: payload.message,
      detail: payload.detail ?? {},
    }),
  }).catch((error: unknown) => ({ ok: false, status: 0, statusText: String(error ?? "fetch failed") }));

  if (!("ok" in response) || !response.ok) {
    return {
      ok: false,
      skipped: false,
      message: "statusText" in response ? response.statusText : "alert request failed",
    } as const;
  }

  return { ok: true, skipped: false, message: "sent" } as const;
}
