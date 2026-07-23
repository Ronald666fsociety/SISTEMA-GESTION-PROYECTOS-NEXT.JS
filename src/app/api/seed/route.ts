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

    // ── 3. Seed Proyectos (All 1000 - 5000 Bs) ──

    // 1. Portal Web Clientes (VERDE)
    const pwc = await prisma.proyecto.create({
      data: {
        codigo: 'PWC-2026',
        nombre: 'Portal Web Clientes',
        descripcion: 'Desarrollo del portal web de autogestión para clientes con catálogo, carrito y pagos integrados',
        presupuestoTotal: 2500,
        costoRealTotal: 1300,
        estado: 'EN_CURSO' as EstadoProyecto,
        fechaInicio: new Date('2026-06-01'),
        fechaFin: new Date('2026-10-15'),
        jefeProyectoId: jefe.id,
        activo: true,
      },
    })

    // 2. App Móvil Delivery (AMARILLO)
    const amd = await prisma.proyecto.create({
      data: {
        codigo: 'AMD-2026',
        nombre: 'App Móvil Delivery',
        descripcion: 'Aplicación móvil para delivery con geolocalización de tiendas, pedidos en tiempo real y notificaciones push',
        presupuestoTotal: 1500,
        costoRealTotal: 1800,
        estado: 'EN_CURSO' as EstadoProyecto,
        fechaInicio: new Date('2026-07-01'),
        fechaFin: new Date('2026-11-30'),
        jefeProyectoId: jefe.id,
        activo: true,
      },
    })

    // 3. Migración Cloud AWS (ROJO)
    const aws = await prisma.proyecto.create({
      data: {
        codigo: 'AWS-2026',
        nombre: 'Migración Cloud AWS',
        descripcion: 'Migración completa de infraestructura on-premise a AWS: redes, bases de datos y plan de contingencia',
        presupuestoTotal: 4500,
        costoRealTotal: 2200,
        estado: 'EN_CURSO' as EstadoProyecto,
        fechaInicio: new Date('2026-04-01'),
        fechaFin: new Date('2026-09-30'),
        jefeProyectoId: jefe.id,
        activo: true,
      },
    })

    // 4. Sistema Facturación Electrónica (ROJO)
    const sfe = await prisma.proyecto.create({
      data: {
        codigo: 'SFE-2026',
        nombre: 'Sistema Facturación Electrónica',
        descripcion: 'Sistema integral de facturación electrónica con integración SIAT, módulo de inventarios y reportes fiscales',
        presupuestoTotal: 3200,
        costoRealTotal: 4600,
        estado: 'EN_CURSO' as EstadoProyecto,
        fechaInicio: new Date('2026-05-01'),
        fechaFin: new Date('2026-12-31'),
        jefeProyectoId: jefe.id,
        activo: true,
      },
    })

    // 5. Intranet Corporativa v2 (VERDE)
    const int = await prisma.proyecto.create({
      data: {
        codigo: 'INT-2026',
        nombre: 'Intranet Corporativa v2',
        descripcion: 'Rediseño completo de la intranet corporativa con módulos de RRHH, gestión documental y dashboard de productividad',
        presupuestoTotal: 1800,
        costoRealTotal: 1750,
        estado: 'EN_CURSO' as EstadoProyecto,
        fechaInicio: new Date('2026-01-15'),
        fechaFin: new Date('2026-05-30'),
        jefeProyectoId: jefe.id,
        activo: true,
      },
    })

    // 6. ERP Módulo Inventarios (AMARILLO)
    const erp = await prisma.proyecto.create({
      data: {
        codigo: 'ERP-INV-2026',
        nombre: 'ERP Módulo Inventarios',
        descripcion: 'Módulo de gestión de inventarios para el ERP corporativo con integración al sistema legacy de almacenes',
        presupuestoTotal: 2800,
        costoRealTotal: 3360,
        estado: 'EN_CURSO' as EstadoProyecto,
        fechaInicio: new Date('2026-03-01'),
        fechaFin: new Date('2026-09-15'),
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

    // Portal Web Clientes (PWC)
    const pwc_diseno = await crearTarea(pwc, null, 'Diseño UX/UI', new Date('2026-06-01'), new Date('2026-06-25'), 100, 500, 500, ana.id)
    const pwc_wire = await crearTarea(pwc, pwc_diseno.id, 'Wireframes', new Date('2026-06-01'), new Date('2026-06-12'), 100, 200, 200, ana.id)
    const pwc_proto = await crearTarea(pwc, pwc_diseno.id, 'Prototipo interactivo', new Date('2026-06-13'), new Date('2026-06-25'), 100, 300, 300, ana.id)
    const pwc_backend = await crearTarea(pwc, null, 'Desarrollo Backend API', new Date('2026-06-15'), new Date('2026-08-20'), 85, 1250, 1100, ana.id)
    const pwc_auth = await crearTarea(pwc, pwc_backend.id, 'Auth JWT y roles', new Date('2026-06-15'), new Date('2026-07-05'), 100, 400, 400, ana.id)
    const pwc_crud = await crearTarea(pwc, pwc_backend.id, 'CRUD entidades', new Date('2026-07-01'), new Date('2026-07-28'), 100, 500, 475, ana.id)
    const pwc_pagos = await crearTarea(pwc, pwc_backend.id, 'Pasarela de pagos', new Date('2026-07-25'), new Date('2026-08-20'), 35, 350, 225, ana.id)

    // App Móvil Delivery (AMD)
    const amd_req = await crearTarea(amd, null, 'Requerimientos y análisis', new Date('2026-07-01'), new Date('2026-07-15'), 100, 250, 250, ana.id)
    const amd_arq = await crearTarea(amd, null, 'Diseño arquitectura', new Date('2026-07-10'), new Date('2026-07-25'), 100, 350, 375, jefe.id)
    const amd_dev = await crearTarea(amd, null, 'Desarrollo React Native', new Date('2026-07-20'), new Date('2026-10-01'), 50, 900, 1175, ana.id)

    // Migración Cloud AWS
    const aws_audit = await crearTarea(aws, null, 'Auditoría infraestructura actual', new Date('2026-04-01'), new Date('2026-05-10'), 100, 750, 750, ana.id)
    const aws_diseno = await crearTarea(aws, null, 'Diseño arquitectura cloud', new Date('2026-05-01'), new Date('2026-06-01'), 100, 1000, 950, jefe.id)
    const aws_red = await crearTarea(aws, null, 'Configuración red y seguridad', new Date('2026-06-01'), new Date('2026-08-15'), 30, 2750, 500, ana.id)

    // Sistema Facturación Electrónica
    const sfe_req = await crearTarea(sfe, null, 'Levantamiento de requerimientos', new Date('2026-05-01'), new Date('2026-06-31'), 0, 750, 1200, ana.id)
    const sfe_bd = await crearTarea(sfe, null, 'Diseño de base de datos', new Date('2026-06-01'), new Date('2026-07-15'), 0, 600, 1000, ana.id)
    const sfe_fact = await crearTarea(sfe, null, 'Desarrollo módulo facturación', new Date('2026-07-01'), new Date('2026-10-30'), 0, 1850, 2400, jefe.id)

    // Intranet Corporativa v2
    const int_diseno = await crearTarea(int, null, 'Diseño y maquetación', new Date('2026-01-15'), new Date('2026-02-10'), 100, 400, 375, ana.id)
    const int_rrhh = await crearTarea(int, null, 'Desarrollo módulo RRHH', new Date('2026-02-01'), new Date('2026-03-31'), 100, 750, 700, ana.id)
    const int_docs = await crearTarea(int, null, 'Desarrollo módulo documentos', new Date('2026-03-15'), new Date('2026-04-30'), 100, 650, 675, ana.id)

    // ERP Módulo Inventarios
    const erp_analisis = await crearTarea(erp, null, 'Análisis y requerimientos', new Date('2026-03-01'), new Date('2026-04-01'), 100, 1000, 1050, ana.id)
    const erp_proto = await crearTarea(erp, null, 'Desarrollo prototipo', new Date('2026-03-20'), new Date('2026-06-15'), 60, 1800, 2310, ana.id)

    // ── 5. Seed Dependencias ──
    await prisma.dependenciaTarea.create({ data: { tareaOrigenId: pwc_diseno.id, tareaDestinoId: pwc_backend.id, tipo: 'FIN_INICIO' as TipoDependencia } })
    await prisma.dependenciaTarea.create({ data: { tareaOrigenId: amd_req.id, tareaDestinoId: amd_arq.id, tipo: 'FIN_INICIO' as TipoDependencia } })

    // ── 6. Seed Asignaciones ──
    await prisma.asignacion.create({ data: { tareaId: pwc_diseno.id, usuarioId: ana.id, horasEstimadas: 40, horasReales: 40 } })
    await prisma.asignacion.create({ data: { tareaId: amd_arq.id, usuarioId: jefe.id, horasEstimadas: 40, horasReales: 42 } })
    await prisma.asignacion.create({ data: { tareaId: aws_diseno.id, usuarioId: jefe.id, horasEstimadas: 80, horasReales: 78 } })

    // ── 7. Seed Auditoría ──
    await prisma.auditoria.create({
      data: {
        entidad: 'Proyecto',
        entidadId: pwc.id,
        accion: 'CREAR',
        usuarioId: admin.id,
        detalle: 'Seed ejecutado correctamente con montos entre 1,000 y 5,000 Bs y semáforos distribuidos (Verde, Amarillo, Rojo)',
        fecha: new Date(),
      },
    })

    return NextResponse.json({
      message: 'Base de datos reinicializada exitosamente con montos de 1,000 Bs a 5,000 Bs y semáforos en Verde, Amarillo y Rojo',
      proyectos: [
        { id: pwc.id, nombre: pwc.nombre, presupuesto: pwc.presupuestoTotal, semaforo: 'VERDE' },
        { id: int.id, nombre: int.nombre, presupuesto: int.presupuestoTotal, semaforo: 'VERDE' },
        { id: amd.id, nombre: amd.nombre, presupuesto: amd.presupuestoTotal, semaforo: 'AMARILLO' },
        { id: erp.id, nombre: erp.nombre, presupuesto: erp.presupuestoTotal, semaforo: 'AMARILLO' },
        { id: aws.id, nombre: aws.nombre, presupuesto: aws.presupuestoTotal, semaforo: 'ROJO' },
        { id: sfe.id, nombre: sfe.nombre, presupuesto: sfe.presupuestoTotal, semaforo: 'ROJO' },
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
