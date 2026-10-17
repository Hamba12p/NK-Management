export function scorePercent(correct: number, total: number): number {
  if (!Number.isInteger(correct) || !Number.isInteger(total) || total <= 0) return 0
  return Math.round((Math.min(Math.max(correct, 0), total) / total) * 10000) / 100
}

export function meetsPassMark(score: number, passMark: number): boolean {
  return Number.isFinite(score) && Number.isFinite(passMark) && score >= passMark
}

export function isRateLimited(ipFailures: number, numberFailures: number, limit = 8): boolean {
  return ipFailures >= limit || numberFailures >= limit
}
