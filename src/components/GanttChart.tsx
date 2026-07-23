'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Spin, Alert, Typography, Card, Empty, Space, Progress, Row, Col, Statistic, Tag, Tooltip } from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import type { GanttTask } from '@/app/api/gantt/proyecto/[idProyecto]/route'

const { Text, Title } = Typography

interface GanttChartProps {
  proyectoId: number
}

const STATUS_COLORS = {
  COMPLETADA: { main: '#10b981', light: '#d1fae5', dark: '#059669', label: 'Completada' },
  EN_CURSO:   { main: '#2563eb', light: '#dbeafe', dark: '#1d4ed8', label: 'En Curso' },
  PENDIENTE:  { main: '#f59e0b', light: '#fef3c7', dark: '#d97706', label: 'Pendiente' },
}

const MONTH_NAMES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DAY_ABBR = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date()
  const parts = dateStr.split('-').map(Number)
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2])
  }
  return new Date(dateStr)
}

function diffDays(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function formatShortDate(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

function getStatus(prog: number): 'COMPLETADA' | 'EN_CURSO' | 'PENDIENTE' {
  return prog >= 100 ? 'COMPLETADA' : prog > 0 ? 'EN_CURSO' : 'PENDIENTE'
}

export default function GanttChart({ proyectoId }: GanttChartProps) {
  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredTask, setHoveredTask] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true

    async function fetchGanttData() {
      try {
        setLoading(true)
        setError(null)

        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
        const res = await fetch(`/api/gantt/proyecto/${proyectoId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) {
          if (res.status === 404) throw new Error('No se encontraron datos del proyecto')
          throw new Error('Error al cargar datos del Gantt')
        }

        const data = await res.json()
        if (mounted) setTasks(data.tasks ?? [])
      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchGanttData()
    return () => { mounted = false }
  }, [proyectoId])

  const stats = useMemo(() => {
    if (tasks.length === 0) return { total: 0, completadas: 0, enCurso: 0, pendientes: 0, promedio: 0 }
    const total = tasks.length
    let completadas = 0, enCurso = 0, pendientes = 0, sumaAvance = 0
    tasks.forEach((t) => {
      const prog = t.progress ?? 0
      sumaAvance += prog
      if (prog >= 100) completadas++
      else if (prog > 0) enCurso++
      else pendientes++
    })
    return { total, completadas, enCurso, pendientes, promedio: Math.round(sumaAvance / total) }
  }, [tasks])

  const timeline = useMemo(() => {
    if (tasks.length === 0) return null

    let minMs = Infinity, maxMs = -Infinity
    tasks.forEach((t) => {
      const s = parseLocalDate(t.start).getTime()
      const e = parseLocalDate(t.end).getTime()
      if (s < minMs) minMs = s
      if (e > maxMs) maxMs = e
    })

    if (minMs === Infinity) {
      minMs = new Date().getTime()
      maxMs = minMs + 30 * 24 * 60 * 60 * 1000
    }

    // Start from the 1st of the start month, end at end of end month
    const gridStart = new Date(new Date(minMs).getFullYear(), new Date(minMs).getMonth(), 1)
    const endDate = new Date(maxMs)
    const gridEnd = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0)

    const totalDayCount = diffDays(gridStart, gridEnd) + 1

    // Generate day cells
    const days: { date: Date; dayNum: number; dow: number; isWeekend: boolean; monthIdx: number }[] = []
    for (let i = 0; i < totalDayCount; i++) {
      const d = new Date(gridStart)
      d.setDate(d.getDate() + i)
      days.push({
        date: d,
        dayNum: d.getDate(),
        dow: d.getDay(),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        monthIdx: d.getMonth(),
      })
    }

    // Generate month groups
    const months: { label: string; year: number; startIdx: number; span: number }[] = []
    let currentMonth = -1, currentYear = -1, currentStart = 0
    days.forEach((d, i) => {
      if (d.date.getMonth() !== currentMonth || d.date.getFullYear() !== currentYear) {
        if (currentMonth >= 0) {
          months.push({ label: MONTH_NAMES_FULL[currentMonth], year: currentYear, startIdx: currentStart, span: i - currentStart })
        }
        currentMonth = d.date.getMonth()
        currentYear = d.date.getFullYear()
        currentStart = i
      }
    })
    months.push({ label: MONTH_NAMES_FULL[currentMonth], year: currentYear, startIdx: currentStart, span: days.length - currentStart })

    // Flatten tasks
    const rootTasks = tasks.filter((t) => !t.tareaPadreId)
    const flatList: GanttTask[] = []
    rootTasks.forEach((root) => {
      flatList.push(root)
      const children = tasks.filter((t) => t.tareaPadreId === Number(root.id))
      children.forEach((c) => flatList.push(c))
    })
    const allIds = new Set(flatList.map((t) => t.id))
    tasks.forEach((t) => { if (!allIds.has(t.id)) flatList.push(t) })

    return { gridStart, totalDayCount, days, months, flatList }
  }, [tasks])

  const formatCurrency = (value: number) => 'Bs ' + Number(value).toFixed(2)

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}><Text type="secondary">Cargando cronograma Gantt...</Text></div>
      </div>
    )
  }

  if (error) return <Alert title="Error" description={error} type="error" showIcon />

  if (tasks.length === 0 || !timeline) {
    return <Empty description="Este proyecto no tiene tareas con fechas asignadas para el diagrama Gantt." style={{ padding: '48px 0' }} />
  }

  const { gridStart, totalDayCount, days, months, flatList } = timeline

  // Layout constants
  const taskColW = 300       // Left panel width
  const dayCellW = 32        // Width per day column
  const monthHeaderH = 28    // Month header row height
  const dayHeaderH = 28      // Day number header row height
  const rowH = 44            // Task row height
  const headerH = monthHeaderH + dayHeaderH
  const gridW = totalDayCount * dayCellW
  const totalW = taskColW + gridW
  const totalH = headerH + flatList.length * rowH

  // Calculate bar position for a task
  const getBar = (task: GanttTask) => {
    const sDate = parseLocalDate(task.start)
    const eDate = parseLocalDate(task.end)
    const startDay = diffDays(gridStart, sDate)
    const endDay = diffDays(gridStart, eDate)
    const x = taskColW + startDay * dayCellW
    const w = Math.max((endDay - startDay + 1) * dayCellW, dayCellW)
    return { x, w }
  }

  // Today marker
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIdx = diffDays(gridStart, today)
  const showToday = todayIdx >= 0 && todayIdx < totalDayCount

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Summary Stats Cards ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: 16 } }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: '#64748b' }}>Avance del Proyecto</Text>}
              value={stats.promedio}
              suffix="%"
              styles={{ content: { color: '#2563eb', fontWeight: 800, fontSize: 20 } }}
            />
            <Progress percent={stats.promedio} showInfo={false} strokeColor="#2563eb" style={{ marginTop: 8 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: 16 } }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: '#64748b' }}><CheckCircleOutlined style={{ color: '#10b981' }} /> Realizadas</Text>}
              value={stats.completadas}
              suffix={`/ ${stats.total}`}
              styles={{ content: { color: '#10b981', fontWeight: 700, fontSize: 20 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: 16 } }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: '#64748b' }}><SyncOutlined style={{ color: '#2563eb' }} /> En Curso</Text>}
              value={stats.enCurso}
              styles={{ content: { color: '#2563eb', fontWeight: 700, fontSize: 20 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: 16 } }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: '#64748b' }}><ClockCircleOutlined style={{ color: '#f59e0b' }} /> Pendientes</Text>}
              value={stats.pendientes}
              styles={{ content: { color: '#f59e0b', fontWeight: 700, fontSize: 20 } }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Title & Legend ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Title level={5} style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>
          Diagrama de Gantt — Cronograma del Proyecto
        </Title>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_COLORS).map(([key, val]) => (
            <Space size={6} key={key}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: val.main }} />
              <Text style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{val.label}</Text>
            </Space>
          ))}
        </div>
      </div>

      {/* ── Gantt Chart ── */}
      <Card
        styles={{ body: { padding: 0 } }}
        style={{
          overflow: 'hidden',
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)',
        }}
      >
        <div
          ref={scrollRef}
          style={{
            width: '100%',
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: 700,
            position: 'relative',
          }}
        >
          <svg width={totalW} height={totalH} style={{ display: 'block', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            <defs>
              <linearGradient id="g-completada" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="g-en_curso" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="g-pendiente" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              <marker id="depArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <polygon points="0 1, 8 4, 0 7" fill="#94a3b8" />
              </marker>
            </defs>

            {/* ═══ HEADER: MONTH ROW ═══ */}
            <rect x={0} y={0} width={taskColW} height={monthHeaderH} fill="#1e293b" />
            <text x={taskColW / 2} y={monthHeaderH / 2 + 5} textAnchor="middle" fill="#ffffff" fontSize={12} fontWeight={700}>
              TAREAS DEL PROYECTO
            </text>

            {months.map((m, i) => {
              const mx = taskColW + m.startIdx * dayCellW
              const mw = m.span * dayCellW
              return (
                <g key={`mh-${i}`}>
                  <rect x={mx} y={0} width={mw} height={monthHeaderH} fill="#1e293b" stroke="#334155" strokeWidth={1} />
                  <text x={mx + mw / 2} y={monthHeaderH / 2 + 5} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontWeight={700} letterSpacing={1}>
                    {m.label.toUpperCase()} {m.year}
                  </text>
                </g>
              )
            })}

            {/* ═══ HEADER: DAY NUMBER ROW ═══ */}
            <rect x={0} y={monthHeaderH} width={taskColW} height={dayHeaderH} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={1} />
            {/* Sub-columns in left panel header */}
            <text x={18} y={monthHeaderH + dayHeaderH / 2 + 4} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight={700}>#</text>
            <text x={44} y={monthHeaderH + dayHeaderH / 2 + 4} textAnchor="start" fill="#64748b" fontSize={10} fontWeight={700}>Nombre de Tarea</text>
            <text x={200} y={monthHeaderH + dayHeaderH / 2 + 4} textAnchor="start" fill="#64748b" fontSize={10} fontWeight={700}>Inicio</text>
            <text x={248} y={monthHeaderH + dayHeaderH / 2 + 4} textAnchor="start" fill="#64748b" fontSize={10} fontWeight={700}>Fin</text>

            {days.map((d, i) => {
              const dx = taskColW + i * dayCellW
              return (
                <g key={`dh-${i}`}>
                  <rect
                    x={dx} y={monthHeaderH} width={dayCellW} height={dayHeaderH}
                    fill={d.isWeekend ? '#f1f5f9' : '#f8fafc'}
                    stroke="#e2e8f0" strokeWidth={0.5}
                  />
                  <text x={dx + dayCellW / 2} y={monthHeaderH + 12} textAnchor="middle" fill={d.isWeekend ? '#94a3b8' : '#475569'} fontSize={8} fontWeight={600}>
                    {DAY_ABBR[d.dow]}
                  </text>
                  <text x={dx + dayCellW / 2} y={monthHeaderH + 23} textAnchor="middle" fill={d.isWeekend ? '#94a3b8' : '#334155'} fontSize={9} fontWeight={700}>
                    {d.dayNum}
                  </text>
                </g>
              )
            })}

            {/* ═══ GRID: Vertical lines per day + weekend shading ═══ */}
            {days.map((d, i) => {
              const dx = taskColW + i * dayCellW
              return (
                <g key={`grid-${i}`}>
                  {/* Weekend column shading */}
                  {d.isWeekend && (
                    <rect x={dx} y={headerH} width={dayCellW} height={flatList.length * rowH} fill="#f8fafc" opacity={0.7} />
                  )}
                  {/* Day grid line */}
                  <line
                    x1={dx} y1={headerH} x2={dx} y2={totalH}
                    stroke={d.dayNum === 1 ? '#cbd5e1' : '#f0f0f0'}
                    strokeWidth={d.dayNum === 1 ? 1.5 : 0.5}
                  />
                </g>
              )
            })}

            {/* Today indicator line */}
            {showToday && (
              <g>
                <line
                  x1={taskColW + todayIdx * dayCellW + dayCellW / 2}
                  y1={headerH}
                  x2={taskColW + todayIdx * dayCellW + dayCellW / 2}
                  y2={totalH}
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                />
                <rect
                  x={taskColW + todayIdx * dayCellW + dayCellW / 2 - 18}
                  y={headerH - 2}
                  width={36} height={14} rx={3}
                  fill="#ef4444"
                />
                <text
                  x={taskColW + todayIdx * dayCellW + dayCellW / 2}
                  y={headerH + 9}
                  textAnchor="middle" fill="#fff" fontSize={8} fontWeight={700}
                >HOY</text>
              </g>
            )}

            {/* Left panel vertical separator */}
            <line x1={taskColW} y1={0} x2={taskColW} y2={totalH} stroke="#cbd5e1" strokeWidth={2} />

            {/* ═══ DEPENDENCY LINES ═══ */}
            {flatList.map((task) => {
              if (!task.dependencies) return null
              const destBar = getBar(task)
              const destIdx = flatList.findIndex((t) => t.id === task.id)
              const destCY = headerH + destIdx * rowH + rowH / 2

              return task.dependencies.split(',').map((s) => s.trim()).filter(Boolean).map((predId) => {
                const predIdx = flatList.findIndex((t) => String(t.id) === predId)
                if (predIdx < 0) return null
                const predBar = getBar(flatList[predIdx])
                const predCY = headerH + predIdx * rowH + rowH / 2

                const x1 = predBar.x + predBar.w
                const x2 = destBar.x
                const dx = Math.max(14, Math.abs(x2 - x1) / 2)

                return (
                  <path
                    key={`dep-${predId}-${task.id}`}
                    d={`M ${x1} ${predCY} C ${x1 + dx} ${predCY}, ${x2 - dx} ${destCY}, ${x2} ${destCY}`}
                    fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3"
                    markerEnd="url(#depArrow)" opacity={0.7}
                  />
                )
              })
            })}

            {/* ═══ TASK ROWS ═══ */}
            {flatList.map((task, idx) => {
              const y = headerH + idx * rowH
              const cy = y + rowH / 2
              const isChild = !!task.tareaPadreId
              const prog = task.progress ?? 0
              const statusKey = getStatus(prog)
              const colors = STATUS_COLORS[statusKey]
              const bar = getBar(task)
              const barH = 22
              const barY = cy - barH / 2
              const isHovered = hoveredTask === String(task.id)

              const sDate = parseLocalDate(task.start)
              const eDate = parseLocalDate(task.end)
              const durDays = Math.max(1, diffDays(sDate, eDate) + 1)

              const maxNameLen = isChild ? 18 : 22
              const displayName = task.name.length > maxNameLen ? task.name.substring(0, maxNameLen - 1) + '…' : task.name

              const gradientId = statusKey === 'COMPLETADA' ? 'g-completada' : statusKey === 'EN_CURSO' ? 'g-en_curso' : 'g-pendiente'

              return (
                <g
                  key={`task-${task.id}`}
                  onMouseEnter={() => setHoveredTask(String(task.id))}
                  onMouseLeave={() => setHoveredTask(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Row background */}
                  <rect x={0} y={y} width={totalW} height={rowH} fill={isHovered ? '#eef2ff' : idx % 2 === 0 ? '#ffffff' : '#fafbfc'} />
                  {/* Row bottom border */}
                  <line x1={0} y1={y + rowH} x2={totalW} y2={y + rowH} stroke="#f0f0f0" strokeWidth={1} />

                  {/* ── Left Panel Content ── */}
                  {/* Row number */}
                  <text x={18} y={cy + 4} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight={700}>
                    {String(idx + 1).padStart(2, '0')}
                  </text>

                  {/* Status color dot */}
                  <circle cx={38 + (isChild ? 12 : 0)} cy={cy} r={4} fill={colors.main} />

                  {/* Task name */}
                  <text
                    x={48 + (isChild ? 12 : 0)} y={cy + 4}
                    textAnchor="start" fill="#1e293b" fontSize={11}
                    fontWeight={isChild ? 400 : 700}
                  >
                    {isChild ? `└ ${displayName}` : displayName}
                  </text>

                  {/* Start date */}
                  <text x={200} y={cy + 4} textAnchor="start" fill="#64748b" fontSize={10}>
                    {formatShortDate(task.start)}
                  </text>

                  {/* End date */}
                  <text x={248} y={cy + 4} textAnchor="start" fill="#64748b" fontSize={10}>
                    {formatShortDate(task.end)}
                  </text>

                  {/* Left panel separator on this row */}
                  <line x1={taskColW} y1={y} x2={taskColW} y2={y + rowH} stroke="#cbd5e1" strokeWidth={1} />

                  {/* ── Gantt Bar (right grid) ── */}
                  {/* Background track */}
                  <rect
                    x={bar.x} y={barY} width={bar.w} height={barH}
                    rx={4} ry={4}
                    fill={colors.light}
                    stroke={colors.main}
                    strokeWidth={0.5}
                    opacity={0.5}
                  />

                  {/* Progress fill */}
                  <rect
                    x={bar.x} y={barY}
                    width={Math.max(bar.w * (prog / 100), prog > 0 ? 8 : 0)}
                    height={barH}
                    rx={4} ry={4}
                    fill={`url(#${gradientId})`}
                  />

                  {/* Bar border */}
                  <rect
                    x={bar.x} y={barY} width={bar.w} height={barH}
                    rx={4} ry={4}
                    fill="none"
                    stroke={isHovered ? colors.dark : colors.main}
                    strokeWidth={isHovered ? 2 : 1}
                  />

                  {/* Progress % text inside bar */}
                  {bar.w > 44 && (
                    <text
                      x={bar.x + bar.w / 2} y={cy + 4}
                      textAnchor="middle" fill={prog > 50 ? '#ffffff' : '#1e293b'}
                      fontSize={10} fontWeight={700}
                    >
                      {prog}%
                    </text>
                  )}

                  {/* Duration label after bar */}
                  <text
                    x={bar.x + bar.w + 8} y={cy + 4}
                    textAnchor="start" fill="#64748b" fontSize={10} fontWeight={500}
                  >
                    {durDays}d {task.responsableNombre ? `· ${task.responsableNombre}` : ''}
                  </text>

                  {/* Completed check icon */}
                  {prog >= 100 && (
                    <g transform={`translate(${bar.x - 14}, ${cy - 6})`}>
                      <circle cx={6} cy={6} r={6} fill="#10b981" />
                      <text x={6} y={10} textAnchor="middle" fill="#fff" fontSize={8} fontWeight={800}>✓</text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </Card>

      {/* ── Task Detail Table ── */}
      <Card
        title={<Text style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Detalle de Tareas del Diagrama</Text>}
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thStyle}>#</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Tarea</th>
                <th style={thStyle}>Responsable</th>
                <th style={thStyle}>Inicio</th>
                <th style={thStyle}>Fin</th>
                <th style={thStyle}>Duración</th>
                <th style={thStyle}>Avance</th>
                <th style={thStyle}>Presupuesto</th>
                <th style={thStyle}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {flatList.map((task, idx) => {
                const prog = task.progress ?? 0
                const statusKey = getStatus(prog)
                const colors = STATUS_COLORS[statusKey]
                const sDate = parseLocalDate(task.start)
                const eDate = parseLocalDate(task.end)
                const durDays = Math.max(1, diffDays(sDate, eDate) + 1)

                return (
                  <tr
                    key={task.id}
                    style={{ borderBottom: '1px solid #f0f0f0', background: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#94a3b8' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'left' }}>
                      <Space size={8}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: colors.main, flexShrink: 0 }} />
                        <span style={{ fontWeight: task.tareaPadreId ? 400 : 600, color: '#1e293b' }}>
                          {task.tareaPadreId ? `  └ ${task.name}` : task.name}
                        </span>
                      </Space>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#475569' }}>{task.responsableNombre ?? '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#475569', fontSize: 12 }}>{task.start}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#475569', fontSize: 12 }}>{task.end}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#475569', fontWeight: 600 }}>{durDays} días</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <Progress percent={task.progress} size="small" strokeColor={colors.main} style={{ width: 80, margin: '0 auto' }} format={() => `${task.progress}%`} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
                      {formatCurrency(task.presupuestoEstimado)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <Tag color={prog >= 100 ? 'success' : prog > 0 ? 'processing' : 'warning'} style={{ fontSize: 11, borderRadius: 12 }}>
                        {colors.label}
                      </Tag>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '2px solid #e2e8f0',
  fontSize: 12,
  fontWeight: 700,
  color: '#64748b',
  textAlign: 'center',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  whiteSpace: 'nowrap',
}
