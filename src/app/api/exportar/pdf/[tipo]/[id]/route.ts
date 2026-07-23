export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromHeaders, requireRole } from '@/lib/auth'
import type { NextRequest } from 'next/server'
import PDFDocument from 'pdfkit'

function parseLocalDate(dateStr: Date | string | null): Date {
  if (!dateStr) return new Date()
  if (dateStr instanceof Date) return dateStr
  const parts = dateStr.split('-').map(Number)
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2])
  }
  return new Date(dateStr)
}

function formatShortDate(date: Date | null): string {
  if (!date) return '—'
  const d = parseLocalDate(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

const MONTH_NAMES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

// GET /api/exportar/pdf/[tipo]/[id] → export PDF for: plan_proyecto/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tipo: string; id: string }> }
): Promise<NextResponse> {
  try {
    const user = getUserFromHeaders(_request.headers)
    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }
    requireRole(['ADMINISTRADOR', 'JEFE_PROYECTO'], user.rol)

    const { tipo, id } = await params

    if (tipo !== 'plan_proyecto') {
      return NextResponse.json(
        { error: 'Tipo de exportación no válido', code: 'INVALID_TYPE' },
        { status: 400 }
      )
    }

    return await exportPlanProyecto(parseInt(id, 10))
  } catch (error: any) {
    if (error.name === 'ForbiddenError') {
      return NextResponse.json(
        { error: error.message, code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
    console.error('PDF plan_proyecto export error:', error)
    return NextResponse.json(
      { error: 'Error al generar PDF', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

async function exportPlanProyecto(proyectoId: number): Promise<NextResponse> {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    include: {
      jefeProyecto: { select: { nombre: true } },
      tareas: {
        where: { activo: true },
        orderBy: { id: 'asc' },
        include: {
          tareaPadre: { select: { nombre: true } },
          responsable: { select: { nombre: true } },
        },
      },
    },
  })

  if (!proyecto || !proyecto.activo) {
    return NextResponse.json(
      { error: 'Proyecto no encontrado', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  const chunks: Buffer[] = []
  
  // Landscape A4 PDF document: 792 x 612
  const doc = new PDFDocument({
    size: [792, 612],
    margin: 40,
    info: {
      Title: `Plan de Proyecto - ${proyecto.nombre}`,
      Author: 'SIGEPRO',
    },
  })

  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks)
      resolve(
        new NextResponse(new Uint8Array(pdfBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="plan_proyecto_${proyectoId}_${dateStr}.pdf"`,
          },
        })
      )
    })
    doc.on('error', reject)

    const pageWidth = 792
    const pageMargin = 40
    const contentWidth = pageWidth - pageMargin * 2 // 712px

    // ── 1. Top Executive Banner ──
    doc.rect(pageMargin, 30, contentWidth, 55).fill('#1e3a8a')
    
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16)
    doc.text('SIGEPRO — INFORME DE PLANIFICACIÓN DE PROYECTO', pageMargin, 42, {
      width: contentWidth,
      align: 'center',
    })
    
    doc.font('Helvetica').fontSize(12).fillColor('#93c5fd')
    doc.text(`${proyecto.nombre}  |  Código: ${proyecto.codigo}`, pageMargin, 63, {
      width: contentWidth,
      align: 'center',
    })

    // ── 2. Project Info Card ──
    let y = 95
    doc.rect(pageMargin, y, contentWidth, 34).fillAndStroke('#f8fafc', '#cbd5e1')
    
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(9)
    doc.text(`Jefe de Proyecto: `, pageMargin + 15, y + 11, { continued: true })
    doc.font('Helvetica').text(proyecto.jefeProyecto.nombre)

    doc.font('Helvetica-Bold').text(`Estado: `, pageMargin + 270, y + 11, { continued: true })
    doc.font('Helvetica').text(proyecto.estado)

    doc.font('Helvetica-Bold').text(`Fecha de Emisión: `, pageMargin + 500, y + 11, { continued: true })
    doc.font('Helvetica').text(new Date().toLocaleDateString('es-ES'))

    // ── 3. Budget Summary Cards ──
    y = 138
    const cardW = (contentWidth - 24) / 3 // 229px
    const cardH = 44

    const presupuesto = Number(proyecto.presupuestoTotal)
    const costoReal = Number(proyecto.costoRealTotal)
    const diferencia = presupuesto - costoReal
    const isPositive = diferencia >= 0

    // Card 1: Presupuesto Total
    doc.rect(pageMargin, y, cardW, cardH).fillAndStroke('#eff6ff', '#bfdbfe')
    doc.fillColor('#1e40af').font('Helvetica-Bold').fontSize(8).text('PRESUPUESTO TOTAL', pageMargin + 10, y + 8)
    doc.fontSize(12).text(`Bs ${presupuesto.toFixed(2)}`, pageMargin + 10, y + 22)

    // Card 2: Costo Real
    doc.rect(pageMargin + cardW + 12, y, cardW, cardH).fillAndStroke('#fef2f2', '#fca5a5')
    doc.fillColor('#991b1b').font('Helvetica-Bold').fontSize(8).text('COSTO REAL EJECUTADO', pageMargin + cardW + 22, y + 8)
    doc.fontSize(12).text(`Bs ${costoReal.toFixed(2)}`, pageMargin + cardW + 22, y + 22)

    // Card 3: Diferencia
    doc.rect(pageMargin + (cardW + 12) * 2, y, cardW, cardH).fillAndStroke(isPositive ? '#f0fdf4' : '#fff1f2', isPositive ? '#86efac' : '#fda4af')
    doc.fillColor(isPositive ? '#166534' : '#9f1239').font('Helvetica-Bold').fontSize(8).text(`DIFERENCIA (${isPositive ? 'SUPERÁVIT' : 'DÉFICIT'})`, pageMargin + (cardW + 12) * 2 + 10, y + 8)
    doc.fontSize(12).text(`Bs ${Math.abs(diferencia).toFixed(2)}`, pageMargin + (cardW + 12) * 2 + 10, y + 22)

    // ── 4. Visual Gantt Chart Section ──
    y = 194
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12)
    doc.text('Diagrama de Gantt — Cronograma de Actividades', pageMargin, y, { width: contentWidth, align: 'center' })
    y += 18

    // Calculate dates range for Gantt Timeline
    let minMs = Infinity
    let maxMs = -Infinity
    proyecto.tareas.forEach((t) => {
      const s = parseLocalDate(t.fechaInicio).getTime()
      const e = parseLocalDate(t.fechaFin).getTime()
      if (s < minMs) minMs = s
      if (e > maxMs) maxMs = e
    })

    if (minMs === Infinity || maxMs === -Infinity) {
      minMs = new Date().getTime()
      maxMs = minMs + 30 * 24 * 60 * 60 * 1000
    }

    const pStart = new Date(minMs)
    pStart.setDate(1)
    const pEnd = new Date(maxMs)
    pEnd.setMonth(pEnd.getMonth() + 1)
    pEnd.setDate(0)

    const totalDays = Math.max(1, Math.ceil((pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)))

    // Gantt layout specs
    const ganttX = pageMargin
    const taskColW = 210 // Task title column
    const timelineX = ganttX + taskColW // 250px
    const timelineW = contentWidth - taskColW // 502px
    const headerH = 20
    const rowH = 18

    // Draw Gantt Container Box
    const ganttBoxH = headerH + Math.min(proyecto.tareas.length, 12) * rowH + 6
    doc.rect(ganttX, y, contentWidth, ganttBoxH).fillAndStroke('#ffffff', '#cbd5e1')

    // Header Background
    doc.rect(ganttX, y, contentWidth, headerH).fill('#f1f5f9')

    // Header Titles
    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8)
    doc.text('#', ganttX + 8, y + 6, { width: 18, align: 'center' })
    doc.text('Tarea / Actividad', ganttX + 30, y + 6, { width: taskColW - 35, align: 'left' })

    // Month columns in Gantt Header
    const monthsInGantt: { label: string; startDay: number; daySpan: number }[] = []
    const cursor = new Date(pStart)
    while (cursor <= pEnd) {
      const monthStart = new Date(cursor)
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
      const effEnd = monthEnd > pEnd ? pEnd : monthEnd

      const startDay = Math.ceil((monthStart.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24))
      const daySpan = Math.ceil((effEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

      monthsInGantt.push({
        label: `${MONTH_NAMES[cursor.getMonth()]}.`,
        startDay,
        daySpan,
      })

      cursor.setMonth(cursor.getMonth() + 1)
      cursor.setDate(1)
    }

    monthsInGantt.forEach((m) => {
      const mx = timelineX + (m.startDay / totalDays) * timelineW
      const mw = (m.daySpan / totalDays) * timelineW
      doc.fillColor('#334155').font('Helvetica-Bold').fontSize(7)
      doc.text(m.label, mx, y + 6, { width: mw, align: 'center' })
      doc.strokeColor('#cbd5e1').lineWidth(0.5).lineCap('butt').moveTo(mx, y).lineTo(mx, y + ganttBoxH).stroke()
    })

    // Separator line between Task column and Timeline grid
    doc.strokeColor('#94a3b8').lineWidth(1).moveTo(timelineX, y).lineTo(timelineX, y + ganttBoxH).stroke()

    // Draw Gantt Task Rows
    let currentGanttY = y + headerH

    proyecto.tareas.slice(0, 12).forEach((t, idx) => {
      if (idx % 2 === 1) {
        doc.rect(ganttX, currentGanttY, contentWidth, rowH).fill('#fafbfc')
      }

      // Row separator
      doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(ganttX, currentGanttY + rowH).lineTo(ganttX + contentWidth, currentGanttY + rowH).stroke()

      // Row number
      doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(7.5)
      doc.text(String(idx + 1).padStart(2, '0'), ganttX + 8, currentGanttY + 5, { width: 18, align: 'center' })

      // Task Name
      const isChild = !!t.tareaPadreId
      const taskName = t.nombre.length > 28 ? t.nombre.substring(0, 26) + '…' : t.nombre
      doc.fillColor('#1e293b').font(isChild ? 'Helvetica' : 'Helvetica-Bold').fontSize(7.5)
      doc.text(isChild ? `└ ${taskName}` : taskName, ganttX + 30 + (isChild ? 10 : 0), currentGanttY + 5, { width: taskColW - 40, align: 'left' })

      // Calculate Gantt Bar position
      const startD = parseLocalDate(t.fechaInicio)
      const endD = parseLocalDate(t.fechaFin)
      const startDiff = (startD.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)
      const endDiff = (endD.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)

      const barX = timelineX + Math.min(Math.max(startDiff / totalDays, 0), 1) * timelineW
      const barEnd = timelineX + Math.min(Math.max(endDiff / totalDays, 0), 1) * timelineW
      const barW = Math.max(barEnd - barX, 22)
      const barH = 10
      const barY = currentGanttY + 4

      // Color by progress: 100% = Green, >0% = Blue, 0% = Amber
      const prog = t.progreso ?? 0
      const barColor = prog >= 100 ? '#10b981' : prog > 0 ? '#2563eb' : '#f59e0b'

      // Bar background
      doc.rect(barX, barY, barW, barH).fill(barColor)

      // Progress text overlay inside or beside bar
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(6.5)
      if (barW > 25) {
        doc.text(`${prog}%`, barX, barY + 2, { width: barW, align: 'center' })
      } else {
        doc.fillColor('#334155')
        doc.text(`${prog}%`, barX + barW + 4, barY + 2)
      }

      currentGanttY += rowH
    })

    // ── 5. Detailed Tasks Table ──
    y = y + ganttBoxH + 18
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12)
    doc.text('Detalle Completo de Tareas del Proyecto', pageMargin, y, { width: contentWidth, align: 'center' })
    y += 18

    const headers = ['#', 'Tarea', 'Tarea Padre', 'Responsable', 'Inicio', 'Fin', '% Avance', 'Presupuesto (Bs)', 'Costo (Bs)']
    const colWidths = [24, 150, 100, 95, 65, 65, 45, 84, 84]
    const tableWidth = colWidths.reduce((a, b) => a + b, 0)
    const tableX = pageMargin + (contentWidth - tableWidth) / 2

    // Helper to draw table header
    function drawTableHeader(headerY: number) {
      doc.rect(tableX, headerY, tableWidth, 20).fill('#2563eb')
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5)
      let xPos = tableX
      headers.forEach((h, i) => {
        const align = i >= 7 ? 'right' : i === 0 || i >= 4 ? 'center' : 'left'
        doc.text(h, xPos + 3, headerY + 6, { width: colWidths[i] - 6, align })
        xPos += colWidths[i]
      })
    }

    drawTableHeader(y)
    let tableRowY = y + 20

    proyecto.tareas.forEach((t, idx) => {
      // Check page break
      if (tableRowY > doc.page.height - 45) {
        doc.addPage()
        tableRowY = 40
        drawTableHeader(tableRowY)
        tableRowY += 20
      }

      if (idx % 2 === 1) {
        doc.rect(tableX, tableRowY, tableWidth, 16).fill('#f8fafc')
      }

      doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(tableX, tableRowY + 16).lineTo(tableX + tableWidth, tableRowY + 16).stroke()

      const rowData = [
        String(t.id),
        t.nombre,
        t.tareaPadre?.nombre ?? '—',
        t.responsable?.nombre ?? '—',
        t.fechaInicio ? formatShortDate(t.fechaInicio) : '—',
        t.fechaFin ? formatShortDate(t.fechaFin) : '—',
        `${t.progreso}%`,
        `Bs ${Number(t.presupuestoEstimado).toFixed(2)}`,
        `Bs ${Number(t.costoEjecutado).toFixed(2)}`,
      ]

      doc.fillColor('#1e293b').font('Helvetica').fontSize(7)
      let xPos = tableX
      rowData.forEach((cellText, i) => {
        const align = i >= 7 ? 'right' : i === 0 || i >= 4 ? 'center' : 'left'
        doc.text(cellText, xPos + 3, tableRowY + 4, { width: colWidths[i] - 6, align })
        xPos += colWidths[i]
      })

      tableRowY += 16
    })

    doc.end()
  })
}
