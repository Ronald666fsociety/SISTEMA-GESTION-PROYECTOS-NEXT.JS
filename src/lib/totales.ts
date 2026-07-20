import { prisma } from '@/lib/prisma'

/**
 * Recalculate proyecto.presupuestoTotal and proyecto.costoRealTotal
 * by summing all tareas' presupuestoEstimado and costoEjecutado in the project.
 *
 * presupuestoTotal = SUM of all Tarea.presupuestoEstimado in the project
 * costoRealTotal   = SUM of all Tarea.costoEjecutado in the project
 *
 * Called after any CUD on Tarea within a project.
 */
export async function recalcularTotales(proyectoId: number): Promise<void> {
  const result = await prisma.tarea.aggregate({
    where: {
      proyectoId,
      activo: true,
    },
    _sum: {
      presupuestoEstimado: true,
      costoEjecutado: true,
    },
  })

  const totalPresupuesto = Number(result._sum.presupuestoEstimado ?? 0)
  const totalCosto = Number(result._sum.costoEjecutado ?? 0)

  await prisma.proyecto.update({
    where: { id: proyectoId },
    data: {
      presupuestoTotal: totalPresupuesto,
      costoRealTotal: Math.round(totalCosto * 100) / 100,
    },
  })
}
