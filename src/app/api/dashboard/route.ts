import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromHeaders } from '@/lib/auth'
import type { DashboardResponse, ApiError } from '@/types'
import type { Prisma } from '@prisma/client'

export async function GET(request: Request): Promise<NextResponse<DashboardResponse | ApiError>> {
  try {
    const user = getUserFromHeaders(request.headers)
    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const projectWhere: Prisma.ProyectoWhereInput = {
      activo: true,
      ...(user.rol !== 'ADMINISTRADOR'
        ? {
            OR: [
              { jefeProyectoId: user.id },
              { tareas: { some: { responsableId: user.id, activo: true } } },
              { tareas: { some: { asignaciones: { some: { usuarioId: user.id } }, activo: true } } },
            ],
          }
        : {}),
    }

    const estadosGroup = await prisma.proyecto.groupBy({
      by: ['estado'],
      where: projectWhere,
      _count: { id: true },
    })

    const estados = estadosGroup.map((e) => ({
      estado: e.estado,
      count: e._count.id,
    }))

    // ── Budget vs actual cost per project (for bar chart) ──
    const proyectos = await prisma.proyecto.findMany({
      where: projectWhere,
      select: {
        id: true,
        nombre: true,
        presupuestoTotal: true,
        costoRealTotal: true,
      },
      orderBy: { id: 'asc' },
    })

    const presupuestos = proyectos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      presupuesto: Number(p.presupuestoTotal),
      costoReal: Number(p.costoRealTotal),
    }))

    // ── Stats counts ──
    const total = proyectos.length
    const planificados = estados.find((e) => e.estado === 'PLANIFICADO')?.count ?? 0
    const enCurso = estados.find((e) => e.estado === 'EN_CURSO')?.count ?? 0
    const finalizados = estados.find((e) => e.estado === 'FINALIZADO')?.count ?? 0

    // ── Recent projects (last 5) ──
    const recentProyectos = await prisma.proyecto.findMany({
      where: projectWhere,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        jefeProyecto: { select: { nombre: true } },
      },
    })

    const recientes = recentProyectos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      estado: p.estado,
      fechaInicio: p.fechaInicio?.toISOString() ?? null,
      fechaFin: p.fechaFin?.toISOString() ?? null,
      jefeProyecto: p.jefeProyecto.nombre,
    }))

    return NextResponse.json({
      estados,
      presupuestos,
      stats: { total, planificados, enCurso, finalizados },
      recientes,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json(
      { error: 'Error al obtener datos del dashboard', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
