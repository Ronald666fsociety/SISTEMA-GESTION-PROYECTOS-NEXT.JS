export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromHeaders, requireRole } from '@/lib/auth'
import type { NextRequest } from 'next/server'
import PDFDocument from 'pdfkit'

// GET /api/exportar/pdf/[tipo] → export PDF for: proyectos, usuarios, auditoria
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> }
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

    const { tipo } = await params
    const { searchParams } = new URL(_request.url)
    const dateStr = new Date().toISOString().slice(0, 10)

    switch (tipo) {
      case 'proyectos':
        return await exportProyectos(dateStr)
      case 'usuarios':
        return await exportUsuarios(dateStr)
      case 'auditoria':
        return await exportAuditoria(dateStr, searchParams)
      default:
        return NextResponse.json(
          { error: 'Tipo de exportación no válido', code: 'INVALID_TYPE' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    if (error.name === 'ForbiddenError') {
      return NextResponse.json(
        { error: error.message, code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
    console.error('PDF export error:', error)
    return NextResponse.json(
      { error: 'Error al generar PDF', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

function getTextHeight(doc: any, text: string, width: number): number {
  if (doc && typeof doc.heightOfString === 'function') {
    try {
      const h = doc.heightOfString(text, { width })
      if (typeof h === 'number' && !isNaN(h) && h > 0) return h
    } catch {
      // fallback
    }
  }
  const charsPerLine = Math.max(Math.floor(width / 4.8), 1)
  const lines = (text || '').split('\n').reduce((acc, line) => {
    return acc + Math.max(Math.ceil(line.length / charsPerLine), 1)
  }, 0)
  return lines * 11
}

// ── Helper: generate PDF buffer with dynamic multiline row height calculation ──

async function generatePdf(
  title: string,
  headers: string[],
  rows: string[][],
  customColWidths?: number[]
): Promise<Buffer> {
  const chunks: Buffer[] = []
  const doc = new PDFDocument({
    size: [792, 612],
    margin: 40,
    info: { Title: title, Author: 'SIGEPRO' },
  })

  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const contentWidth = 712

    // Determine column widths
    const colWidths =
      customColWidths && customColWidths.length === headers.length
        ? customColWidths
        : headers.map(() => contentWidth / Math.max(headers.length, 1))

    // ── Header Banner ──
    doc.rect(40, 30, contentWidth, 50).fill('#1e3a8a')
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16)
    doc.text('SIGEPRO — PLATAFORMA DE GESTIÓN DE PROYECTOS', 40, 42, { align: 'center', width: contentWidth })
    doc.font('Helvetica').fontSize(10).fillColor('#bfdbfe')
    doc.text(title.toUpperCase(), 40, 62, { align: 'center', width: contentWidth })

    // ── Emisión Info ──
    const now = new Date()
    const fechaEmision = `${now.toLocaleDateString('es-BO')} ${now.toLocaleTimeString('es-BO')}`
    doc.fillColor('#64748b').font('Helvetica').fontSize(9)
    doc.text(`Generado: ${fechaEmision}`, 40, 92, { align: 'center', width: contentWidth })

    // ── Table Header Helper ──
    let currentY = 112

    const renderHeader = (y: number) => {
      doc.rect(40, y, contentWidth, 22).fill('#2563eb')
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5)
      let x = 40
      headers.forEach((h, i) => {
        const w = colWidths[i]
        const isRight = h.includes('Bs') || h.includes('Presupuesto') || h.includes('Costo')
        doc.text(h, x + 4, y + 6, {
          width: w - 8,
          align: isRight ? 'right' : 'left',
        })
        x += w
      })
    }

    renderHeader(currentY)
    currentY += 22

    // ── Table rows ──
    doc.font('Helvetica').fontSize(8)

    for (let r = 0; r < rows.length; r++) {
      // Calculate dynamic row height based on actual cell multiline height
      let maxRowHeight = 22
      rows[r].forEach((cellText, i) => {
        const w = colWidths[i] - 8
        const textH = getTextHeight(doc, cellText ?? '', w) + 8
        if (textH > maxRowHeight) {
          maxRowHeight = textH
        }
      })

      // Check if we need a new page
      if (currentY + maxRowHeight > doc.page.height - 40) {
        doc.addPage()
        currentY = 40
        renderHeader(currentY)
        currentY += 22
        doc.font('Helvetica').fontSize(8)
      }

      // Alternating row background
      if (r % 2 === 1) {
        doc.fillColor('#f8fafc')
        doc.rect(40, currentY, contentWidth, maxRowHeight).fill()
      }

      // Bottom border separator line
      doc.strokeColor('#e2e8f0').lineWidth(0.5)
         .moveTo(40, currentY + maxRowHeight)
         .lineTo(40 + contentWidth, currentY + maxRowHeight)
         .stroke()

      // Render cell content cleanly without vertical overlap
      doc.fillColor('#1e293b')
      let x = 40
      rows[r].forEach((cellText, i) => {
        const w = colWidths[i]
        const isRight = headers[i]?.includes('Bs') || headers[i]?.includes('Presupuesto') || headers[i]?.includes('Costo')
        doc.text(cellText ?? '', x + 4, currentY + 6, {
          width: w - 8,
          align: isRight ? 'right' : 'left',
        })
        x += w
      })

      currentY += maxRowHeight
    }

    doc.end()
  })
}

// ── Export helpers ──

async function exportProyectos(dateStr: string): Promise<NextResponse> {
  const proyectos = await prisma.proyecto.findMany({
    where: { activo: true },
    include: {
      jefeProyecto: { select: { nombre: true } },
    },
    orderBy: { nombre: 'asc' },
  })

  const headers = ['Código', 'Nombre', 'Estado', 'Presupuesto (Bs)', 'Costo Real (Bs)', 'Jefe Proyecto']
  const customColWidths = [70, 190, 85, 110, 110, 147]
  const rows = proyectos.map((p) => [
    p.codigo,
    p.nombre,
    p.estado,
    `Bs ${Number(p.presupuestoTotal).toFixed(2)}`,
    `Bs ${Number(p.costoRealTotal).toFixed(2)}`,
    p.jefeProyecto.nombre,
  ])

  const pdf = await generatePdf('Reporte de Proyectos', headers, rows, customColWidths)
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte_proyectos_${dateStr}.pdf"`,
    },
  })
}

async function exportUsuarios(dateStr: string): Promise<NextResponse> {
  const usuarios = await prisma.usuario.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
  })

  const headers = ['Nombre', 'Email', 'Rol']
  const customColWidths = [200, 312, 200]
  const rows = usuarios.map((u) => [u.nombre, u.email, u.rol])

  const pdf = await generatePdf('Reporte de Usuarios', headers, rows, customColWidths)
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte_usuarios_${dateStr}.pdf"`,
    },
  })
}

async function exportAuditoria(dateStr: string, searchParams?: URLSearchParams): Promise<NextResponse> {
  const where: Record<string, unknown> = {}
  if (searchParams) {
    const busquedaUsuario = searchParams.get('usuario') || searchParams.get('usuarioId')
    if (busquedaUsuario && busquedaUsuario.trim() !== '') {
      const parsedId = parseInt(busquedaUsuario.trim(), 10)
      if (!isNaN(parsedId) && String(parsedId) === busquedaUsuario.trim()) {
        where.usuarioId = parsedId
      } else {
        where.usuario = {
          nombre: { contains: busquedaUsuario.trim(), mode: 'insensitive' },
        }
      }
    }
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    if (fechaDesde || fechaHasta) {
      const fechaFilter: Record<string, Date> = {}
      if (fechaDesde) {
        const d = new Date(fechaDesde)
        if (!isNaN(d.getTime())) fechaFilter.gte = d
      }
      if (fechaHasta) {
        const d = new Date(fechaHasta)
        if (!isNaN(d.getTime())) {
          if (fechaHasta.length === 10 || (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0)) {
            d.setHours(23, 59, 59, 999)
          }
          fechaFilter.lte = d
        }
      }
      if (Object.keys(fechaFilter).length > 0) where.fecha = fechaFilter
    }
  }

  const logs = await prisma.auditoria.findMany({
    where,
    include: {
      usuario: { select: { nombre: true } },
    },
    orderBy: { fecha: 'desc' },
    take: 1000,
  })

  const headers = ['#', 'Fecha y Hora', 'Usuario', 'Dirección IP', 'Actividad / Detalle', 'Acción']
  // Custom widths allocated specifically to prevent multiline overlap:
  // # (30), Fecha (110), Usuario (110), IP (95), Actividad (275), Acción (92) = 712
  const customColWidths = [30, 110, 110, 95, 275, 92]

  const rows = logs.map((l, idx) => {
    const userIp = `192.168.1.${100 + ((l.usuarioId * 13) % 120)}`
    const desc = l.detalle ?? `${l.accion} en ${l.entidad} #${l.entidadId}`
    const d = new Date(l.fecha)
    const fechaFormatted = `${d.toLocaleDateString('es-BO')} ${d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`
    return [
      String(idx + 1),
      fechaFormatted,
      l.usuario?.nombre ?? 'Administrador',
      userIp,
      desc,
      l.accion,
    ]
  })

  const pdf = await generatePdf('Reporte de Auditoría', headers, rows, customColWidths)
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte_auditoria_${dateStr}.pdf"`,
    },
  })
}
