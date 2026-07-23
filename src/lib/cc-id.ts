/** Admin portal / Control Center pod id — must match the deploy that should see backup rows. */
export function getCcId(): string {
  return (process.env.CC_ID ?? '').trim()
}

export function hasCcId(): boolean {
  return Boolean(getCcId())
}
