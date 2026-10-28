import { createHash, timingSafeEqual } from 'node:crypto'

export function matchesSharedSecret(candidate: string | null, expected: string | undefined) {
  const candidateDigest = createHash('sha256').update(candidate || '').digest()
  const expectedDigest = createHash('sha256').update(expected || '').digest()
  const matches = timingSafeEqual(candidateDigest, expectedDigest)
  return Boolean(candidate && expected && matches)
}
