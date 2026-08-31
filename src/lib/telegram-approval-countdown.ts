import {
  ADMIN_PENDING_COUNTDOWN_SEC,
  secondsLeftFromCreatedAt,
} from "@/lib/telegram-approval-templates"

type MessageRef = { chatId: string; messageId: number }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<MessageRef | null> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    result?: { message_id?: number }
  }
  if (!res.ok || !data.ok || !data.result?.message_id) return null
  return { chatId, messageId: data.result.message_id }
}

async function editMessage(
  botToken: string,
  ref: MessageRef,
  text: string,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: ref.chatId,
      message_id: ref.messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  }).catch(() => {})
}

async function runCountdownEdits(params: {
  botToken: string
  refs: MessageRef[]
  createdAtMs: number
  ttlSec: number
  buildText: (secondsLeft: number) => string
}): Promise<void> {
  const { botToken, refs, createdAtMs, ttlSec, buildText } = params
  if (refs.length === 0) return

  while (true) {
    const secondsLeft = secondsLeftFromCreatedAt(createdAtMs, Date.now(), ttlSec)
    const text = buildText(secondsLeft)
    await Promise.all(refs.map((ref) => editMessage(botToken, ref, text)))
    if (secondsLeft <= 0) break
    await sleep(1000)
  }
}

/** Send approval Telegram(s) and refresh ⏱ Time left every second (90s member TTL). */
export async function sendTelegramApprovalWithCountdown(params: {
  botToken: string
  chatIds: string[]
  createdAtMs?: number
  ttlSec?: number
  wrapMessage?: (body: string) => string
  buildText: (secondsLeft: number) => string
}): Promise<boolean> {
  const {
    botToken,
    chatIds,
    createdAtMs = Date.now(),
    ttlSec = ADMIN_PENDING_COUNTDOWN_SEC,
    wrapMessage = (body) => body,
    buildText,
  } = params

  if (!botToken || chatIds.length === 0) return false

  const initialSeconds = secondsLeftFromCreatedAt(createdAtMs, Date.now(), ttlSec)
  const initialText = wrapMessage(buildText(initialSeconds))

  const refs = (
    await Promise.all(chatIds.map((chatId) => sendMessage(botToken, chatId, initialText)))
  ).filter((ref): ref is MessageRef => ref !== null)

  if (refs.length === 0) return false

  void runCountdownEdits({
    botToken,
    refs,
    createdAtMs,
    ttlSec,
    buildText: (secondsLeft) => wrapMessage(buildText(secondsLeft)),
  })

  return true
}
