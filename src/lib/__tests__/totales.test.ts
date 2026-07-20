import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    tarea: {
      aggregate: vi.fn(),
    },
    proyecto: {
      update: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { recalcularTotales } from '@/lib/totales'

describe('recalcularTotales', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sums presupuestoEstimado to presupuestoTotal and costoEjecutado to costoRealTotal', async () => {
    vi.mocked(prisma.tarea.aggregate).mockResolvedValue({
      _sum: { presupuestoEstimado: 10000 as any, costoEjecutado: 4500 as any },
      _count: {} as any,
      _avg: {} as any,
      _min: {} as any,
      _max: {} as any,
    })

    await recalcularTotales(1)

    expect(prisma.proyecto.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        presupuestoTotal: 10000,
        costoRealTotal: 4500,
      },
    })
  })

  it('handles zero tareas gracefully (empty project)', async () => {
    vi.mocked(prisma.tarea.aggregate).mockResolvedValue({
      _sum: { presupuestoEstimado: null, costoEjecutado: null },
      _count: {} as any,
      _avg: {} as any,
      _min: {} as any,
      _max: {} as any,
    })

    await recalcularTotales(2)

    expect(prisma.proyecto.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        presupuestoTotal: 0,
        costoRealTotal: 0,
      },
    })
  })

  it('handles multiple tareas with different costs', async () => {
    vi.mocked(prisma.tarea.aggregate).mockResolvedValue({
      _sum: { presupuestoEstimado: 25000 as any, costoEjecutado: 10000 as any },
      _count: {} as any,
      _avg: {} as any,
      _min: {} as any,
      _max: {} as any,
    })

    await recalcularTotales(3)

    expect(prisma.proyecto.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: {
        presupuestoTotal: 25000,
        costoRealTotal: 10000,
      },
    })
  })
})
