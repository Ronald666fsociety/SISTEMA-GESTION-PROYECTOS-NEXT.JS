import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashSync } from 'bcryptjs'
import type { EstadoProyecto, RolUsuario, TipoDependencia } from '@prisma/client'

export async function GET() {
  return executeSeed()
}

export async function POST() {
  return executeSeed()
}

async function executeSeed() {
  try {
    // ── 1. Clean existing data in dependency order ──
    await prisma.auditoria.deleteMany()
    await prisma.asignacion.deleteMany()
    await prisma.dependenciaTarea.deleteMany()
    await prisma.tarea.deleteMany()
    await prisma.proyecto.deleteMany()
    await prisma.usuario.deleteMany()

    // ── 2. Seed Usuarios ──
    const passwordHash = hashSync('123456', 10)

    const admin = await prisma.usuario.create({
      data: {
        nombre: 'Admin Principal',
        email: 'admin@transandina.com',
        password: passwordHash,
        rol: 'ADMINISTRADOR' as RolUsuario,
        activo: true,
      },
    })

    const jefe = await prisma.usuario.create({
      data: {
        nombre: 'Carlos Mendoza',
        email: 'cmendoza@transandina.com',
        password: passwordHash,
        rol: 'JEFE_PROYECTO' as RolUsuario,
        activo: true,
      },
    })

    const ana = await prisma.usuario.create({
      data: {
        nombre: 'Ana Lopez',
        email: 'alopez@transandina.com',
        password: passwordHash,
        rol: 'USUARIO' as RolUsuario,
        activo: true,
      },
    })

    // ── 3. Seed Proyectos (Interactive & balanced: ROJO, AMARILLO, VERDE) ──

    // 1. App Móvil Delivery — ROJO (Sobrecosto 80% y Retraso Crítico)
    const amd = await prisma.proyecto.create({
      data: {
        codigo: 'AMD-2026',
        nombre: 'App Móvil Delivery',
        descripcion: 'Aplicación móvil para delivery con geolocalización de tiendas y notificaciones push en tiempo real',
        presupuestoTotal: 2000,
        costoRealTotal: 3600,
        estado: 'EN_CURSO' as EstadoProyecto,
        fechaInicio: new Date('2026-01-01'),
        fechaFin: new Date('2026-06-30'),
        jefeProyectoId: jefe.id,
        activo: true,
      },
    })

    // 2. Sistema Facturación SIAT — ROJO (Sobrecosto 40% y Retraso 55%)
    const sfe = await prisma.proyecto.create({
      data: {
        codigo: 'SIAT-2026',
        nombre: 'Sistema Facturación SIAT',
        descripcion: 'Sistema integral de facturación electrónica con integración SIAT e impuestos nacionales',
        presupuestoTotal: 3500,
        costoRealTotal: 4900,
        estado: 'EN_CURSO' as EstadoProyecto,
        fechaInicio: new Date('2026-02-01'),
        fechaFin: new Date('2026-08-31'),
        jefeProyectoId: jefe.id,
        activo: true,
      },
    })

    // 3. Migración Cloud AWS — AMARILLO (Sobrecosto moderado 20%)
    const aws = await prisma.proyecto.create({
      data: {
        codigo: 'AWS-2026',
        nombre: 'Migración Cloud AWS',
        descripcion: 'Migración completa de infraestructura on-premise a AWS: redes, bases de datos y contingencia',
        presupuestoTotal: 4000,
        costoRealTotal: 4800,
        estado: 'EN_CURSO' as EstadoProyecto,
        fechaInicio: new Date('2026-05-01'),
        fechaFin: new Date('2026-11-30'),
        jefeProyectoId: jefe.id,
        activo: true,
      },
    })

    // 4. Plataforma E-Commerce V2 — AMARILLO (Desviación moderada)
    const erp = await prisma.proyecto.create({
      data: {
        codigo: 'ECM-2026',
        nombre: 'Plataforma E-Commerce V2',
        descripcion: 'Plataforma de comercio electrónico con pasarela de pagos integrados y catálogo dinámico',
        presupuestoTotal: 2800,
        costoRealTotal: 3360,
        estado: 'EN_CURSO' as EstadoProyecto,
        fechaInicio: new Date('2026-04-15'),
        fechaFin: new Date('2026-10-30'),
        jefeProyectoId: jefe.id,
        activo: true,
      },
    })

    // 5. Portal Corporativo Clientes — VERDE (Excelente desempeño)
    const pwc = await prisma.proyecto.create({
      data: {
        codigo: 'PWC-2026',
        nombre: 'Portal Corporativo Clientes',
        descripcion: 'Portal web de autogestión para clientes con dashboard de métricas y soporte',
        presupuestoTotal: 2500,
        costoRealTotal: 1400,
        estado: 'EN_CURSO' as EstadoProyecto,
        fechaInicio: new Date('2026-06-01'),
        fechaFin: new Date('2026-12-15'),
        jefeProyectoId: jefe.id,
        activo: true,
      },
    })

    // 6. Intranet Recursos Humanos — VERDE (Finalizado con superávit)
    const int = await prisma.proyecto.create({
      data: {
        codigo: 'INT-2026',
        nombre: 'Intranet Recursos Humanos',
        descripcion: 'Rediseño de la intranet corporativa para el departamento de RRHH y gestión documental',
        presupuestoTotal: 1800,
        costoRealTotal: 1650,
        estado: 'FINALIZADO' as EstadoProyecto,
        fechaInicio: new Date('2026-01-01'),
        fechaFin: new Date('2026-05-30'),
        jefeProyectoId: jefe.id,
        activo: true,
      },
    })

    // ── 4. Seed Tareas ──
    async function crearTarea(
      proyecto: { id: number },
      tareaPadreId: number | null,
      nombre: string,
      inicio: Date,
      fin: Date,
      avance: number,
      presupuesto: number,
      costo: number,
      responsableId: number | null,
    ) {
      return prisma.tarea.create({
        data: {
          nombre,
          fechaInicio: inicio,
          fechaFin: fin,
          progreso: avance,
          presupuestoEstimado: presupuesto,
          costoEjecutado: costo,
          proyectoId: proyecto.id,
          tareaPadreId,
          responsableId,
        },
      })
    }

    // App Móvil Delivery (ROJO)
    const amd_req = await crearTarea(amd, null, 'Requerimientos y análisis', new Date('2026-01-01'), new Date('2026-02-15'), 100, 500, 900, ana.id)
    const amd_dev = await crearTarea(amd, null, 'Desarrollo App Móvil', new Date('2026-02-15'), new Date('2026-06-30'), 25, 1500, 2700, ana.id)

    // Sistema Facturación SIAT (ROJO)
    const sfe_req = await crearTarea(sfe, null, 'Levantamiento requerimientos SIAT', new Date('2026-02-01'), new Date('2026-04-15'), 100, 1000, 1400, ana.id)
    const sfe_fact = await crearTarea(sfe, null, 'Módulo de emisión fiscal', new Date('2026-04-15'), new Date('2026-08-31'), 30, 2500, 3500, jefe.id)

    // Migración Cloud AWS (AMARILLO)
    const aws_audit = await crearTarea(aws, null, 'Auditoría infraestructura', new Date('2026-05-01'), new Date('2026-07-01'), 100, 1000, 1200, ana.id)
    const aws_red = await crearTarea(aws, null, 'Configuración VPC y Redes', new Date('2026-07-01'), new Date('2026-11-30'), 40, 3000, 3600, ana.id)

    // Plataforma E-Commerce V2 (AMARILLO)
    const erp_analisis = await crearTarea(erp, null, 'Diseño de catálogo y pagos', new Date('2026-04-15'), new Date('2026-06-30'), 100, 800, 960, ana.id)
    const erp_proto = await crearTarea(erp, null, 'Integración pasarela', new Date('2026-07-01'), new Date('2026-10-30'), 45, 2000, 2400, ana.id)

    // Portal Corporativo Clientes (VERDE)
    const pwc_diseno = await crearTarea(pwc, null, 'Diseño UX/UI y Frontend', new Date('2026-06-01'), new Date('2026-09-01'), 90, 1000, 600, ana.id)
    const pwc_backend = await crearTarea(pwc, null, 'Desarrollo API y Backend', new Date('2026-09-01'), new Date('2026-12-15'), 40, 1500, 800, ana.id)

    // Intranet Recursos Humanos (VERDE)
    const int_diseno = await crearTarea(int, null, 'Módulo RRHH y Documentos', new Date('2026-01-01'), new Date('2026-03-31'), 100, 800, 750, ana.id)
    const int_pruebas = await crearTarea(int, null, 'Despliegue y capacitación', new Date('2026-04-01'), new Date('2026-05-30'), 100, 1000, 900, ana.id)

    // ── 5. Seed Dependencias ──
    await prisma.dependenciaTarea.create({ data: { tareaOrigenId: amd_req.id, tareaDestinoId: amd_dev.id, tipo: 'FIN_INICIO' as TipoDependencia } })
    await prisma.dependenciaTarea.create({ data: { tareaOrigenId: sfe_req.id, tareaDestinoId: sfe_fact.id, tipo: 'FIN_INICIO' as TipoDependencia } })

    // ── 6. Seed Asignaciones ──
    await prisma.asignacion.create({ data: { tareaId: amd_dev.id, usuarioId: ana.id, horasEstimadas: 120, horasReales: 180 } })
    await prisma.asignacion.create({ data: { tareaId: sfe_fact.id, usuarioId: jefe.id, horasEstimadas: 160, horasReales: 210 } })

    // ── 7. Seed Auditoría ──
    await prisma.auditoria.create({
      data: {
        entidad: 'Proyecto',
        entidadId: amd.id,
        accion: 'CREAR',
        usuarioId: admin.id,
        detalle: 'Reset completo y creación de nuevos proyectos interactivos (ROJO, AMARILLO, VERDE)',
        fecha: new Date(),
      },
    })

    return NextResponse.json({
      message: 'Base de datos reinicializada con 6 proyectos totalmente interactivos y balanceados',
      proyectos: [
        { id: amd.id, nombre: amd.nombre, presupuesto: amd.presupuestoTotal, costoReal: amd.costoRealTotal, semaforo: 'ROJO' },
        { id: sfe.id, nombre: sfe.nombre, presupuesto: sfe.presupuestoTotal, costoReal: sfe.costoRealTotal, semaforo: 'ROJO' },
        { id: aws.id, nombre: aws.nombre, presupuesto: aws.presupuestoTotal, costoReal: aws.costoRealTotal, semaforo: 'AMARILLO' },
        { id: erp.id, nombre: erp.nombre, presupuesto: erp.presupuestoTotal, costoReal: erp.costoRealTotal, semaforo: 'AMARILLO' },
        { id: pwc.id, nombre: pwc.nombre, presupuesto: pwc.presupuestoTotal, costoReal: pwc.costoRealTotal, semaforo: 'VERDE' },
        { id: int.id, nombre: int.nombre, presupuesto: int.presupuestoTotal, costoReal: int.costoRealTotal, semaforo: 'VERDE' },
      ],
    })
  } catch (error: any) {
    console.error('Seed API error:', error)
    return NextResponse.json(
      { error: 'Error al ejecutar seed en la base de datos', detalle: error.message },
      { status: 500 }
    )
  }
}
