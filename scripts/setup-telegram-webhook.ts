/**
 * One-time script to register the Telegram webhook with Telegram's servers.
 *
 * Run once after deploying the Edge Function:
 *   npm run setup-webhook
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN       — Bot token from @BotFather
 *   TELEGRAM_WEBHOOK_SECRET  — Secret token for validating incoming webhook requests
 *   NEXT_PUBLIC_SUPABASE_URL — Your Supabase project URL (e.g. https://<ref>.supabase.co)
 *
 * The webhook is registered to the Supabase Edge Function URL:
 *   https://<ref>.supabase.co/functions/v1/telegram-webhook
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN is not set");
  process.exit(1);
}
if (!secret) {
  console.error("Error: TELEGRAM_WEBHOOK_SECRET is not set");
  process.exit(1);
}
if (!supabaseUrl) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL is not set");
  process.exit(1);
}

const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`;
const apiBase = `https://api.telegram.org/bot${token}`;

async function setWebhook(): Promise<void> {
  console.log(`Registering webhook: ${webhookUrl}`);

  const res = await fetch(`${apiBase}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message"],
    }),
  });

  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    console.error("setWebhook failed:", data.description);
    process.exit(1);
  }
  console.log("Webhook registered successfully.");
}

async function getWebhookInfo(): Promise<void> {
  const res = await fetch(`${apiBase}/getWebhookInfo`);
  const data = (await res.json()) as { ok: boolean; result?: unknown };
  if (data.ok) {
    console.log("Webhook info:", JSON.stringify(data.result, null, 2));
  }
}

async function main() {
  await setWebhook();
  await getWebhookInfo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
