import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dependenciaTarea: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { detectaCiclo } from '@/lib/ciclico'

describe('detectaCiclo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when same task (self-reference)', async () => {
    const result = await detectaCiclo(1, 1)
    expect(result).toBe(true)
    expect(prisma.dependenciaTarea.findMany).not.toHaveBeenCalled()
  })

  it('returns true when cycle exists (chain that closes loop)', async () => {
    // If adding 3 -> 1, starting BFS at 3: 3 -> 2 -> 1, reaching 1
    vi.mocked(prisma.dependenciaTarea.findMany)
      .mockResolvedValueOnce([{ tareaDestinoId: 2 }] as any)
      .mockResolvedValueOnce([{ tareaDestinoId: 1 }] as any)

    const result = await detectaCiclo(1, 3)
    expect(result).toBe(true)
  })

  it('returns false when no cycle exists', async () => {
    vi.mocked(prisma.dependenciaTarea.findMany).mockResolvedValue([])

    const result = await detectaCiclo(1, 2)
    expect(result).toBe(false)
  })
})
