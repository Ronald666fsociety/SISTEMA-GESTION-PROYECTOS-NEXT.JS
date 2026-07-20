import { prisma } from '@/lib/prisma'

/**
 * Detect if adding a dependency from origenId to destinoId would create a cycle.
 *
 * Uses a recursive CTE to traverse forward from destinoId through existing
 * dependencies. If we reach origenId, a cycle exists.
 *
 * @returns true if a cycle would be created
 */
export async function detectaCiclo(
  origenId: number,
  destinoId: number
): Promise<boolean> {
  if (origenId === destinoId) return true

  const visited = new Set<number>()
  const queue = [destinoId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === origenId) return true
    visited.add(current)

    const nextDeps = await prisma.dependenciaTarea.findMany({
      where: { tareaOrigenId: current },
      select: { tareaDestinoId: true },
    })

    for (const dep of nextDeps) {
      if (!visited.has(dep.tareaDestinoId)) {
        queue.push(dep.tareaDestinoId)
      }
    }
  }

  return false
}
