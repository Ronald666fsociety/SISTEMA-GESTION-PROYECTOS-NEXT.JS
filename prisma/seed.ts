import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashSync } from 'bcryptjs'
import type {
  EstadoProyecto,
  RolUsuario,
  TipoDependencia,
} from '@prisma/client'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('>>> Iniciando seed de datos enriquecidos...')

  // ── 1. Clean existing data in dependency order ──
  await prisma.auditoria.deleteMany()
  await prisma.asignacion.deleteMany()
  await prisma.dependenciaTarea.deleteMany()
  await prisma.tarea.deleteMany()
  await prisma.proyecto.deleteMany()
  await prisma.usuario.deleteMany()

  console.log('>>> Datos anteriores eliminados.')

  // ── 2. Seed Usuarios (exactly 3 — one per role) ──
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

  console.log('>>> Usuarios creados correctamente.')

  // ── 3. Seed Proyectos (6 — varied states, budgets, dates) ──

  // 1. Portal Web Clientes — EN_CURSO
  const pwc = await prisma.proyecto.create({
    data: {
      codigo: 'PWC-2026',
      nombre: 'Portal Web Clientes',
      descripcion: 'Desarrollo del portal web de autogestión para clientes con catálogo, carrito y pagos integrados',
      presupuestoTotal: 2125,
      costoRealTotal: 1300,
      estado: 'EN_CURSO' as EstadoProyecto,
      fechaInicio: new Date('2026-06-01'),
      fechaFin: new Date('2026-10-15'),
      jefeProyectoId: jefe.id,
      activo: true,
    },
  })

  // 2. App Móvil Delivery — EN_CURSO (OVER BUDGET)
  const amd = await prisma.proyecto.create({
    data: {
      codigo: 'AMD-2026',
      nombre: 'App Móvil Delivery',
      descripcion: 'Aplicación móvil para delivery con geolocalización de tiendas, pedidos en tiempo real y notificaciones push',
      presupuestoTotal: 1200,
      costoRealTotal: 1375,
      estado: 'EN_CURSO' as EstadoProyecto,
      fechaInicio: new Date('2026-07-01'),
      fechaFin: new Date('2026-11-30'),
      jefeProyectoId: jefe.id,
      activo: true,
    },
  })

  // 3. Migración Cloud AWS — EN_CURSO
  const aws = await prisma.proyecto.create({
    data: {
      codigo: 'AWS-2026',
      nombre: 'Migración Cloud AWS',
      descripcion: 'Migración completa de infraestructura on-premise a AWS: redes, bases de datos, servidores de aplicación y plan de contingencia',
      presupuestoTotal: 5000,
      costoRealTotal: 950,
      estado: 'EN_CURSO' as EstadoProyecto,
      fechaInicio: new Date('2026-05-15'),
      fechaFin: new Date('2026-12-31'),
      jefeProyectoId: jefe.id,
      activo: true,
    },
  })

  // 4. Sistema Facturación Electrónica — PLANIFICADO
  const sfe = await prisma.proyecto.create({
    data: {
      codigo: 'SFE-2026',
      nombre: 'Sistema Facturación Electrónica',
      descripcion: 'Sistema integral de facturación electrónica con integración SIAT, módulo de inventarios y reportes fiscales',
      presupuestoTotal: 3000,
      costoRealTotal: 0,
      estado: 'PLANIFICADO' as EstadoProyecto,
      fechaInicio: new Date('2026-08-01'),
      fechaFin: new Date('2027-01-31'),
      jefeProyectoId: jefe.id,
      activo: true,
    },
  })

  // 5. Intranet Corporativa v2 — FINALIZADO
  const int = await prisma.proyecto.create({
    data: {
      codigo: 'INT-2026',
      nombre: 'Intranet Corporativa v2',
      descripcion: 'Rediseño completo de la intranet corporativa con módulos de RRHH, gestión documental y dashboard de productividad',
      presupuestoTotal: 1125,
      costoRealTotal: 1080,
      estado: 'FINALIZADO' as EstadoProyecto,
      fechaInicio: new Date('2026-01-15'),
      fechaFin: new Date('2026-05-30'),
      jefeProyectoId: jefe.id,
      activo: false,
    },
  })

  // 6. ERP Módulo Inventarios — CANCELADO
  const erp = await prisma.proyecto.create({
    data: {
      codigo: 'ERP-INV-2026',
      nombre: 'ERP Módulo Inventarios',
      descripcion: 'Módulo de gestión de inventarios para el ERP corporativo con integración al sistema legacy de almacenes',
      presupuestoTotal: 1875,
      costoRealTotal: 700,
      estado: 'CANCELADO' as EstadoProyecto,
      fechaInicio: new Date('2026-03-01'),
      fechaFin: new Date('2026-07-15'),
      jefeProyectoId: jefe.id,
      activo: false,
    },
  })

  console.log('>>> Proyectos creados correctamente.')

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

  // ─── PORTAL WEB CLIENTES (PWC) ───
  const pwc_diseno = await crearTarea(pwc, null, 'Diseño UX/UI',
    new Date('2026-06-01'), new Date('2026-06-25'), 100, 500, 500, ana.id)

  const pwc_wire = await crearTarea(pwc, pwc_diseno.id, 'Wireframes',
    new Date('2026-06-01'), new Date('2026-06-12'), 100, 200, 200, ana.id)

  const pwc_proto = await crearTarea(pwc, pwc_diseno.id, 'Prototipo interactivo',
    new Date('2026-06-13'), new Date('2026-06-25'), 100, 300, 300, ana.id)

  const pwc_backend = await crearTarea(pwc, null, 'Desarrollo Backend API',
    new Date('2026-06-15'), new Date('2026-08-20'), 85, 1250, 1100, ana.id)

  const pwc_auth = await crearTarea(pwc, pwc_backend.id, 'Auth JWT y roles',
    new Date('2026-06-15'), new Date('2026-07-05'), 100, 400, 400, ana.id)

  const pwc_crud = await crearTarea(pwc, pwc_backend.id, 'CRUD entidades',
    new Date('2026-07-01'), new Date('2026-07-28'), 100, 500, 475, ana.id)

  const pwc_pagos = await crearTarea(pwc, pwc_backend.id, 'Pasarela de pagos',
    new Date('2026-07-25'), new Date('2026-08-20'), 35, 350, 225, ana.id)

  const pwc_frontend = await crearTarea(pwc, null, 'Frontend React',
    new Date('2026-07-01'), new Date('2026-09-20'), 60, 1500, 900, ana.id)

  const pwc_catalogo = await crearTarea(pwc, pwc_frontend.id, 'Catálogo de productos',
    new Date('2026-07-01'), new Date('2026-07-30'), 100, 600, 550, ana.id)

  const pwc_carrito = await crearTarea(pwc, pwc_frontend.id, 'Carrito y checkout',
    new Date('2026-07-28'), new Date('2026-08-25'), 25, 500, 200, ana.id)

  const pwc_panel = await crearTarea(pwc, pwc_frontend.id, 'Panel de usuario',
    new Date('2026-08-15'), new Date('2026-09-20'), 15, 400, 150, ana.id)

  const pwc_qa = await crearTarea(pwc, null, 'QA y testing automatizado',
    new Date('2026-09-01'), new Date('2026-10-05'), 10, 600, 75, ana.id)

  const pwc_deploy = await crearTarea(pwc, null, 'Despliegue producción',
    new Date('2026-10-01'), new Date('2026-10-15'), 0, 400, 0, ana.id)

  // ─── APP MÓVIL DELIVERY (AMD) ───
  const amd_req = await crearTarea(amd, null, 'Requerimientos y análisis',
    new Date('2026-07-01'), new Date('2026-07-15'), 100, 250, 250, ana.id)

  const amd_arq = await crearTarea(amd, null, 'Diseño arquitectura',
    new Date('2026-07-10'), new Date('2026-07-25'), 100, 350, 375, jefe.id)

  const amd_dev = await crearTarea(amd, null, 'Desarrollo React Native',
    new Date('2026-07-20'), new Date('2026-10-01'), 50, 1000, 1250, ana.id)

  const amd_tiendas = await crearTarea(amd, amd_dev.id, 'Pantalla tiendas y mapa',
    new Date('2026-07-20'), new Date('2026-08-15'), 100, 400, 525, ana.id)

  const amd_pedidos = await crearTarea(amd, amd_dev.id, 'Gestión de pedidos real-time',
    new Date('2026-08-10'), new Date('2026-09-15'), 25, 350, 425, ana.id)

  const amd_push = await crearTarea(amd, amd_dev.id, 'Notificaciones push',
    new Date('2026-09-01'), new Date('2026-10-01'), 0, 250, 300, ana.id)

  const amd_integ = await crearTarea(amd, null, 'Integración API restaurantes',
    new Date('2026-09-01'), new Date('2026-10-31'), 30, 500, 525, ana.id)

  const amd_qa = await crearTarea(amd, null, 'QA y pruebas aceptación',
    new Date('2026-10-15'), new Date('2026-11-15'), 0, 300, 350, ana.id)

  const amd_lanza = await crearTarea(amd, null, 'Lanzamiento tiendas',
    new Date('2026-11-10'), new Date('2026-11-30'), 0, 250, 0, ana.id)

  // ─── MIGRACIÓN CLOUD AWS ───
  const aws_audit = await crearTarea(aws, null, 'Auditoría infraestructura actual',
    new Date('2026-05-15'), new Date('2026-06-10'), 100, 750, 750, ana.id)

  const aws_diseno = await crearTarea(aws, null, 'Diseño arquitectura cloud',
    new Date('2026-06-01'), new Date('2026-07-01'), 100, 1000, 950, jefe.id)

  const aws_red = await crearTarea(aws, null, 'Configuración red y seguridad',
    new Date('2026-06-20'), new Date('2026-09-15'), 70, 2000, 1250, ana.id)

  const aws_vpc = await crearTarea(aws, aws_red.id, 'VPC y subredes',
    new Date('2026-06-20'), new Date('2026-07-25'), 100, 750, 600, ana.id)

  const aws_sg = await crearTarea(aws, aws_red.id, 'Security Groups y NACLs',
    new Date('2026-07-20'), new Date('2026-08-20'), 85, 500, 375, ana.id)

  const aws_vpn = await crearTarea(aws, aws_red.id, 'VPN / Direct Connect',
    new Date('2026-08-10'), new Date('2026-09-15'), 10, 750, 275, ana.id)

  const aws_bd = await crearTarea(aws, null, 'Migración bases de datos',
    new Date('2026-08-01'), new Date('2026-10-31'), 15, 2500, 50, ana.id)

  const aws_serv = await crearTarea(aws, null, 'Migración servidores app',
    new Date('2026-09-15'), new Date('2026-11-30'), 0, 2250, 0, ana.id)

  const aws_carga = await crearTarea(aws, null, 'Pruebas de carga',
    new Date('2026-10-15'), new Date('2026-12-01'), 0, 1000, 0, ana.id)

  const aws_cutover = await crearTarea(aws, null, 'Cutover y rollback plan',
    new Date('2026-11-25'), new Date('2026-12-31'), 0, 500, 0, ana.id)

  // ─── SISTEMA FACTURACIÓN ELECTRÓNICA (SFE) — all 0% (PLANIFICADO) ───
  const sfe_req = await crearTarea(sfe, null, 'Levantamiento de requerimientos',
    new Date('2026-08-01'), new Date('2026-08-31'), 0, 750, 0, ana.id)

  const sfe_bd = await crearTarea(sfe, null, 'Diseño de base de datos',
    new Date('2026-08-20'), new Date('2026-09-15'), 0, 600, 0, ana.id)

  const sfe_fact = await crearTarea(sfe, null, 'Desarrollo módulo facturación',
    new Date('2026-09-01'), new Date('2026-11-30'), 0, 2000, 0, jefe.id)

  const sfe_emision = await crearTarea(sfe, sfe_fact.id, 'Emisión facturas electrónicas',
    new Date('2026-09-01'), new Date('2026-10-31'), 0, 1000, 0, ana.id)

  const sfe_siat = await crearTarea(sfe, sfe_fact.id, 'Integración SIAT impuestos',
    new Date('2026-10-15'), new Date('2026-11-30'), 0, 1000, 0, ana.id)

  const sfe_inv = await crearTarea(sfe, null, 'Desarrollo módulo inventarios',
    new Date('2026-10-01'), new Date('2026-12-31'), 0, 1250, 0, ana.id)

  const sfe_pruebas = await crearTarea(sfe, null, 'Pruebas integrales',
    new Date('2026-12-15'), new Date('2027-01-15'), 0, 900, 0, ana.id)

  const sfe_cap = await crearTarea(sfe, null, 'Capacitación y despliegue',
    new Date('2027-01-10'), new Date('2027-01-31'), 0, 500, 0, ana.id)

  // ─── INTRANET CORPORATIVA V2 (INT) — all 100% (FINALIZADO) ───
  const int_diseno = await crearTarea(int, null, 'Diseño y maquetación',
    new Date('2026-01-15'), new Date('2026-02-10'), 100, 400, 375, ana.id)

  const int_rrhh = await crearTarea(int, null, 'Desarrollo módulo RRHH',
    new Date('2026-02-01'), new Date('2026-03-31'), 100, 750, 700, ana.id)

  const int_docs = await crearTarea(int, null, 'Desarrollo módulo documentos',
    new Date('2026-03-15'), new Date('2026-04-30'), 100, 600, 600, ana.id)

  const int_pruebas = await crearTarea(int, null, 'Pruebas y despliegue',
    new Date('2026-04-20'), new Date('2026-05-30'), 100, 500, 475, ana.id)

  // ─── ERP MÓDULO INVENTARIOS — varied progress (CANCELADO) ───
  const erp_analisis = await crearTarea(erp, null, 'Análisis y requerimientos',
    new Date('2026-03-01'), new Date('2026-04-01'), 100, 1000, 1050, ana.id)

  const erp_proto = await crearTarea(erp, null, 'Desarrollo prototipo',
    new Date('2026-03-20'), new Date('2026-06-15'), 60, 1750, 350, ana.id)

  const erp_integ = await crearTarea(erp, null, 'Integración ERP legacy',
    new Date('2026-05-01'), new Date('2026-07-15'), 0, 1000, 0, ana.id)

  console.log('>>> Tareas creadas exitosamente.')

  // ── 5. Seed Dependencias (20 dependencies) ──
  async function crearDependencia(origenId: number, destinoId: number, tipo: TipoDependencia) {
    return prisma.dependenciaTarea.create({
      data: { tareaOrigenId: origenId, tareaDestinoId: destinoId, tipo },
    })
  }

  // Portal Web Clientes chain: Diseño → Backend → Frontend → QA → Despliegue
  await crearDependencia(pwc_diseno.id, pwc_backend.id, 'FIN_INICIO')
  await crearDependencia(pwc_backend.id, pwc_frontend.id, 'FIN_INICIO')
  await crearDependencia(pwc_frontend.id, pwc_qa.id, 'FIN_INICIO')
  await crearDependencia(pwc_qa.id, pwc_deploy.id, 'FIN_INICIO')

  // App Móvil Delivery chain: Requerimientos → Arquitectura → Desarrollo → Integración → QA
  await crearDependencia(amd_req.id, amd_arq.id, 'FIN_INICIO')
  await crearDependencia(amd_arq.id, amd_dev.id, 'FIN_INICIO')
  await crearDependencia(amd_dev.id, amd_integ.id, 'FIN_INICIO')
  await crearDependencia(amd_integ.id, amd_qa.id, 'FIN_INICIO')

  // Migración Cloud AWS chain: Auditoría → Diseño → Red → BD → Servidores
  await crearDependencia(aws_audit.id, aws_diseno.id, 'FIN_INICIO')
  await crearDependencia(aws_diseno.id, aws_red.id, 'FIN_INICIO')
  await crearDependencia(aws_red.id, aws_bd.id, 'FIN_INICIO')
  await crearDependencia(aws_bd.id, aws_serv.id, 'FIN_INICIO')

  // Sistema Facturación Electrónica chain: Requerimientos → BD → Facturación → Inventarios
  await crearDependencia(sfe_req.id, sfe_bd.id, 'FIN_INICIO')
  await crearDependencia(sfe_bd.id, sfe_fact.id, 'FIN_INICIO')
  await crearDependencia(sfe_fact.id, sfe_inv.id, 'FIN_INICIO')

  // Intranet Corporativa: parallel start + coordinated finish
  await crearDependencia(int_diseno.id, int_rrhh.id, 'INICIO_INICIO') // parallel work
  await crearDependencia(int_diseno.id, int_docs.id, 'INICIO_INICIO') // parallel work
  await crearDependencia(int_rrhh.id, int_pruebas.id, 'FIN_FIN')      // both must finish together
  await crearDependencia(int_docs.id, int_pruebas.id, 'FIN_FIN')      // both must finish together

  // ERP Módulo Inventarios chain: Análisis → Prototipo → Integración
  await crearDependencia(erp_analisis.id, erp_proto.id, 'FIN_INICIO')
  await crearDependencia(erp_proto.id, erp_integ.id, 'FIN_INICIO')

  console.log('>>> Dependencias creadas.')

  // ── 6. Seed Asignaciones ──
  async function crearAsignacion(tareaId: number, usuarioId: number, hrsEst: number, hrsReales: number) {
    return prisma.asignacion.create({
      data: { tareaId, usuarioId, horasEstimadas: hrsEst, horasReales: hrsReales },
    })
  }

  // Portal Web Clientes — Ana does most, Carlos a few
  await crearAsignacion(pwc_diseno.id, ana.id, 40, 40)
  await crearAsignacion(pwc_wire.id, ana.id, 25, 25)
  await crearAsignacion(pwc_proto.id, ana.id, 30, 29)
  await crearAsignacion(pwc_backend.id, jefe.id, 100, 85)
  await crearAsignacion(pwc_auth.id, ana.id, 40, 40)
  await crearAsignacion(pwc_crud.id, ana.id, 50, 50)
  await crearAsignacion(pwc_pagos.id, ana.id, 35, 12)
  await crearAsignacion(pwc_frontend.id, ana.id, 120, 72)
  await crearAsignacion(pwc_catalogo.id, ana.id, 60, 60)
  await crearAsignacion(pwc_carrito.id, ana.id, 50, 13)
  await crearAsignacion(pwc_panel.id, ana.id, 40, 6)
  await crearAsignacion(pwc_qa.id, ana.id, 60, 6)
  await crearAsignacion(pwc_deploy.id, ana.id, 40, 0)

  // App Móvil Delivery
  await crearAsignacion(amd_req.id, ana.id, 30, 30)
  await crearAsignacion(amd_arq.id, jefe.id, 40, 42)
  await crearAsignacion(amd_dev.id, ana.id, 100, 50)
  await crearAsignacion(amd_tiendas.id, ana.id, 50, 66)
  await crearAsignacion(amd_pedidos.id, ana.id, 40, 10)
  await crearAsignacion(amd_push.id, ana.id, 30, 0)
  await crearAsignacion(amd_integ.id, ana.id, 50, 15)
  await crearAsignacion(amd_qa.id, ana.id, 35, 0)
  await crearAsignacion(amd_lanza.id, ana.id, 25, 0)

  // Migración Cloud AWS
  await crearAsignacion(aws_audit.id, ana.id, 60, 58)
  await crearAsignacion(aws_diseno.id, jefe.id, 80, 78)
  await crearAsignacion(aws_red.id, ana.id, 120, 84)
  await crearAsignacion(aws_vpc.id, ana.id, 60, 60)
  await crearAsignacion(aws_sg.id, ana.id, 45, 38)
  await crearAsignacion(aws_vpn.id, ana.id, 50, 5)
  await crearAsignacion(aws_bd.id, ana.id, 80, 12)
  await crearAsignacion(aws_serv.id, ana.id, 90, 0)
  await crearAsignacion(aws_carga.id, ana.id, 60, 0)
  await crearAsignacion(aws_cutover.id, ana.id, 40, 0)

  // Sistema Facturación Electrónica — all 0% progress, 0 real hours
  await crearAsignacion(sfe_req.id, ana.id, 60, 0)
  await crearAsignacion(sfe_bd.id, ana.id, 50, 0)
  await crearAsignacion(sfe_fact.id, jefe.id, 100, 0)
  await crearAsignacion(sfe_emision.id, ana.id, 70, 0)
  await crearAsignacion(sfe_siat.id, ana.id, 60, 0)
  await crearAsignacion(sfe_inv.id, ana.id, 80, 0)
  await crearAsignacion(sfe_pruebas.id, ana.id, 60, 0)
  await crearAsignacion(sfe_cap.id, ana.id, 40, 0)

  // Intranet Corporativa v2 — all 100%
  await crearAsignacion(int_diseno.id, ana.id, 40, 38)
  await crearAsignacion(int_rrhh.id, ana.id, 70, 66)
  await crearAsignacion(int_docs.id, ana.id, 55, 54)
  await crearAsignacion(int_pruebas.id, ana.id, 45, 43)

  // ERP Módulo Inventarios
  await crearAsignacion(erp_analisis.id, ana.id, 80, 85)
  await crearAsignacion(erp_proto.id, ana.id, 90, 50)
  await crearAsignacion(erp_integ.id, ana.id, 70, 0)

  console.log('>>> Asignaciones creadas.')

  // ── 7. Seed Auditoría (12 entries) ──
  const auditEntries = [
    {
      entidad: 'Proyecto', entidadId: int.id, accion: 'CREAR', usuarioId: admin.id,
      detalle: 'Creación del proyecto Intranet Corporativa v2',
      fecha: new Date('2026-01-15T08:00:00'),
    },
    {
      entidad: 'Proyecto', entidadId: erp.id, accion: 'CREAR', usuarioId: admin.id,
      detalle: 'Creación del proyecto ERP Módulo Inventarios',
      fecha: new Date('2026-03-01T08:30:00'),
    },
    {
      entidad: 'Proyecto', entidadId: aws.id, accion: 'CREAR', usuarioId: admin.id,
      detalle: 'Creación del proyecto Migración Cloud AWS',
      fecha: new Date('2026-05-15T09:00:00'),
    },
    {
      entidad: 'Proyecto', entidadId: pwc.id, accion: 'CREAR', usuarioId: admin.id,
      detalle: 'Creación del proyecto Portal Web Clientes',
      fecha: new Date('2026-06-01T08:00:00'),
    },
    {
      entidad: 'Tarea', entidadId: aws_audit.id, accion: 'ACTUALIZAR', usuarioId: ana.id,
      detalle: 'Auditoría de infraestructura completada al 100%',
      fecha: new Date('2026-06-10T16:00:00'),
    },
    {
      entidad: 'Tarea', entidadId: pwc_diseno.id, accion: 'ACTUALIZAR', usuarioId: ana.id,
      detalle: 'Diseño UX/UI finalizado — entregables aprobados por el cliente',
      fecha: new Date('2026-06-25T17:30:00'),
    },
    {
      entidad: 'Tarea', entidadId: amd_arq.id, accion: 'ACTUALIZAR', usuarioId: jefe.id,
      detalle: 'Diseño de arquitectura completado — se excedió el presupuesto en Bs 25',
      fecha: new Date('2026-07-25T15:00:00'),
    },
    {
      entidad: 'Proyecto', entidadId: amd.id, accion: 'ACTUALIZAR', usuarioId: jefe.id,
      detalle: 'Presupuesto ajustado de Bs 1,200 a Bs 1,200 por ampliación del alcance de integración',
      fecha: new Date('2026-07-01T10:00:00'),
    },
    {
      entidad: 'Proyecto', entidadId: erp.id, accion: 'ACTUALIZAR', usuarioId: jefe.id,
      detalle: 'Proyecto cancelado por recorte presupuestario corporativo',
      fecha: new Date('2026-07-15T09:00:00'),
    },
    {
      entidad: 'Tarea', entidadId: erp_analisis.id, accion: 'ACTUALIZAR', usuarioId: ana.id,
      detalle: 'Análisis y requerimientos de ERP inventarios completado con sobrecosto de Bs 50',
      fecha: new Date('2026-04-01T14:00:00'),
    },
    {
      entidad: 'Tarea', entidadId: pwc_auth.id, accion: 'ACTUALIZAR', usuarioId: ana.id,
      detalle: 'Módulo de autenticación JWT desplegado en staging',
      fecha: new Date('2026-07-05T11:00:00'),
    },
    {
      entidad: 'Tarea', entidadId: int_pruebas.id, accion: 'ACTUALIZAR', usuarioId: ana.id,
      detalle: 'Pruebas integrales de Intranet v2 superadas — proyecto listo para cierre',
      fecha: new Date('2026-05-28T18:00:00'),
    },
  ]

  for (const entry of auditEntries) {
    await prisma.auditoria.create({ data: entry })
  }

  console.log('>>> Datos de prueba cargados correctamente!')
}

main()
  .catch((e) => {
    console.error('Error durante el seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
