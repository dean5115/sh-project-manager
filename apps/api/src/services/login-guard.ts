// נעילת חשבון לפי כתובת מייל — משלימה את הגבלת הקצב לפי IP.
// מגנה גם מול תוקף שמחליף IP/VPN כדי לעקוף את ההגבלה ולנסות לנחש סיסמה/קוד OTP על אותו חשבון שוב ושוב.

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 דקות

const attempts = new Map<string, { count: number; lockedUntil: number }>()

export function checkAccountLockout(email: string): string | null {
  const entry = attempts.get(email)
  if (entry && Date.now() < entry.lockedUntil) {
    const minutesLeft = Math.ceil((entry.lockedUntil - Date.now()) / 60000)
    return `יותר מדי ניסיונות כושלים. נסה שוב בעוד ${minutesLeft} דקות.`
  }
  return null
}

export function recordFailedAttempt(email: string): void {
  const entry = attempts.get(email) ?? { count: 0, lockedUntil: 0 }
  entry.count += 1
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS
    entry.count = 0
  }
  attempts.set(email, entry)
}

export function clearFailedAttempts(email: string): void {
  attempts.delete(email)
}
