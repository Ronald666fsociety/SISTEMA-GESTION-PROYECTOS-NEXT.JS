'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Spin, Alert, Typography, Radio, Card, Empty, Space, Progress, Row, Col, Statistic, Tag } from 'antd'
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

type ViewMode = 'Week' | 'Day' | 'Month'

// Palette of vibrant colors for Gantt bars (matches reference image style)
const BAR_COLORS = [
  { main: '#e74c3c', light: '#fadbd8', gradient: ['#e74c3c', '#f1948a'] },  // Red
  { main: '#e67e22', light: '#fdebd0', gradient: ['#e67e22', '#f0b27a'] },  // Orange
  { main: '#f1c40f', light: '#fef9e7', gradient: ['#f1c40f', '#f9e154'] },  // Yellow
  { main: '#2ecc71', light: '#d5f5e3', gradient: ['#2ecc71', '#82e0aa'] },  // Green
  { main: '#1abc9c', light: '#d1f2eb', gradient: ['#1abc9c', '#76d7c4'] },  // Teal
  { main: '#3498db', light: '#d6eaf8', gradient: ['#3498db', '#85c1e9'] },  // Blue
  { main: '#9b59b6', light: '#e8daef', gradient: ['#9b59b6', '#c39bd3'] },  // Purple
  { main: '#e91e63', light: '#fce4ec', gradient: ['#e91e63', '#f48fb1'] },  // Pink
  { main: '#00bcd4', light: '#e0f7fa', gradient: ['#00bcd4', '#4dd0e1'] },  // Cyan
  { main: '#ff5722', light: '#fbe9e7', gradient: ['#ff5722', '#ff8a65'] },  // Deep Orange
]

const MONTH_NAMES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date()
  const parts = dateStr.split('-').map(Number)
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2])
  }
  return new Date(dateStr)
}

function formatDateRange(startStr: string, endStr: string): string {
  const start = parseLocalDate(startStr)
  const end = parseLocalDate(endStr)
  const sDay = start.getDate()
  const eDay = end.getDate()
  const sMonth = MONTH_NAMES[start.getMonth()]
  const eMonth = MONTH_NAMES[end.getMonth()]

  if (sMonth === eMonth) {
    if (sDay === 1 && eDay >= 28) {
      return sMonth
    }
    return `${sDay} - ${eDay} ${sMonth}`
  }
  if (sDay === 1 && eDay >= 28) {
    return `${sMonth} - ${eMonth}`
  }
  return `${sDay} ${sMonth} - ${eDay} ${eMonth}`
}

export default function GanttChart({ proyectoId }: GanttChartProps) {
  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('Month')

  // ── Fetch Gantt data ──
  useEffect(() => {
    let mounted = true

    async function fetchGanttData() {
      try {
        setLoading(true)
        setError(null)

        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
        const res = await fetch(`/api/gantt/proyecto/${proyectoId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('No se encontraron datos del proyecto')
          }
          throw new Error('Error al cargar datos del Gantt')
        }

        const data = await res.json()
        if (mounted) {
          setTasks(data.tasks ?? [])
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Error desconocido'
          )
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchGanttData()

    return () => {
      mounted = false
    }
  }, [proyectoId])

  // ── Stats Calculation ──
  const stats = useMemo(() => {
    if (tasks.length === 0) return { total: 0, completadas: 0, enCurso: 0, pendientes: 0, promedio: 0 }

    const total = tasks.length
    let completadas = 0
    let enCurso = 0
    let pendientes = 0
    let sumaAvance = 0

    tasks.forEach((t) => {
      const prog = t.progress ?? 0
      sumaAvance += prog
      if (prog >= 100) completadas++
      else if (prog > 0) enCurso++
      else pendientes++
    })

    const promedio = Math.round(sumaAvance / total)

    return { total, completadas, enCurso, pendientes, promedio }
  }, [tasks])

  // ── Timeline & Layout Calculations ──
  const timelineData = useMemo(() => {
    if (tasks.length === 0) return null

    let minMs = Infinity
    let maxMs = -Infinity

    tasks.forEach((t) => {
      const startD = parseLocalDate(t.start)
      const endD = parseLocalDate(t.end)
      if (startD.getTime() < minMs) minMs = startD.getTime()
      if (endD.getTime() > maxMs) maxMs = endD.getTime()
    })

    if (minMs === Infinity || maxMs === -Infinity) {
      minMs = new Date().getTime()
      maxMs = minMs + 30 * 24 * 60 * 60 * 1000
    }

    // Add buffer
    const projectStartDate = new Date(minMs)
    projectStartDate.setDate(1) // Align to 1st of month
    
    const projectEndDate = new Date(maxMs)
    projectEndDate.setMonth(projectEndDate.getMonth() + 1)
    projectEndDate.setDate(0) // Last day of the month

    const totalDays = Math.max(
      Math.ceil((projectEndDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24)),
      14
    )

    // Generate month headers
    const months: { label: string; startDay: number; daySpan: number; fullLabel: string }[] = []
    const cursor = new Date(projectStartDate)
    while (cursor <= projectEndDate) {
      const monthStart = new Date(cursor)
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
      const effectiveEnd = monthEnd > projectEndDate ? projectEndDate : monthEnd
      
      const startDay = Math.ceil((monthStart.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24))
      const daySpan = Math.ceil((effectiveEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

      months.push({
        label: `${MONTH_NAMES[cursor.getMonth()]}.`,
        fullLabel: MONTH_NAMES_FULL[cursor.getMonth()],
        startDay,
        daySpan,
      })

      cursor.setMonth(cursor.getMonth() + 1)
      cursor.setDate(1)
    }

    // Flatten tasks (parents first, then children)
    const rootTasks = tasks.filter((t) => !t.tareaPadreId)
    const flatList: GanttTask[] = []
    
    rootTasks.forEach((root) => {
      flatList.push(root)
      const children = tasks.filter((t) => t.tareaPadreId === Number(root.id))
      children.forEach((c) => flatList.push(c))
    })

    // Include orphans
    const allIds = new Set(flatList.map((t) => t.id))
    tasks.forEach((t) => {
      if (!allIds.has(t.id)) flatList.push(t)
    })

    const labelColumnWidth = 50 // Row number column
    const contentWidth = Math.max(900, months.length * 160)
    const totalSvgWidth = labelColumnWidth + contentWidth

    return {
      projectStartDate,
      totalDays,
      months,
      flatList,
      labelColumnWidth,
      contentWidth,
      totalSvgWidth,
    }
  }, [tasks, viewMode])

  const formatCurrency = (value: number) => {
    return 'Bs ' + value.toLocaleString('es-BO', { minimumFractionDigits: 2 })
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">Cargando cronograma Gantt...</Text>
        </div>
      </div>
    )
  }

  if (error) {
    return <Alert message="Error" description={error} type="error" showIcon />
  }

  if (tasks.length === 0 || !timelineData) {
    return (
      <Empty
        description="Este proyecto no tiene tareas con fechas asignadas para el diagrama Gantt."
        style={{ padding: '48px 0' }}
      />
    )
  }

  const {
    projectStartDate,
    totalDays,
    months,
    flatList,
    labelColumnWidth,
    contentWidth,
    totalSvgWidth,
  } = timelineData

  const rowHeight = 56
  const headerHeight = 44
  const totalSvgHeight = headerHeight + flatList.length * rowHeight + 10

  // Calculate X coordinate for any date
  const getX = (dateStr: string) => {
    const d = parseLocalDate(dateStr)
    const diffDays = (d.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24)
    const ratio = Math.min(Math.max(diffDays / totalDays, 0), 1)
    return labelColumnWidth + ratio * contentWidth
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Summary Stats Cards ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card bodyStyle={{ padding: 16 }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: '#64748b' }}>Avance del Proyecto</Text>}
              value={stats.promedio}
              suffix="%"
              valueStyle={{ color: '#2563eb', fontWeight: 800, fontSize: 20 }}
            />
            <Progress percent={stats.promedio} showInfo={false} strokeColor="#2563eb" style={{ marginTop: 8 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bodyStyle={{ padding: 16 }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: '#64748b' }}><CheckCircleOutlined style={{ color: '#10b981' }} /> Realizadas</Text>}
              value={stats.completadas}
              suffix={`/ ${stats.total}`}
              valueStyle={{ color: '#10b981', fontWeight: 700, fontSize: 20 }}
            />
            <Text style={{ fontSize: 11, color: '#64748b' }}>100% completadas</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bodyStyle={{ padding: 16 }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: '#64748b' }}><SyncOutlined style={{ color: '#06b6d4' }} /> En Curso</Text>}
              value={stats.enCurso}
              valueStyle={{ color: '#06b6d4', fontWeight: 700, fontSize: 20 }}
            />
            <Text style={{ fontSize: 11, color: '#64748b' }}>En ejecución activa</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bodyStyle={{ padding: 16 }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: '#64748b' }}><ClockCircleOutlined style={{ color: '#f59e0b' }} /> Pendientes</Text>}
              value={stats.pendientes}
              valueStyle={{ color: '#f59e0b', fontWeight: 700, fontSize: 20 }}
            />
            <Text style={{ fontSize: 11, color: '#64748b' }}>Programadas</Text>
          </Card>
        </Col>
      </Row>

      {/* ── View Controls ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Title level={5} style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>
          Diagrama de Gantt — Composición
        </Title>

        <Space align="center">
          <Text style={{ fontSize: 13, color: '#64748b' }}>
            Escala:
          </Text>
          <Radio.Group
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            size="small"
          >
            <Radio.Button value="Week">Semanas</Radio.Button>
            <Radio.Button value="Day">Días</Radio.Button>
            <Radio.Button value="Month">Meses</Radio.Button>
          </Radio.Group>
        </Space>
      </div>

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '0 4px' }}>
        <Space size={6}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#10b981' }} />
          <Text style={{ fontSize: 12, color: '#475569' }}>Completada</Text>
        </Space>
        <Space size={6}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#3498db' }} />
          <Text style={{ fontSize: 12, color: '#475569' }}>En curso</Text>
        </Space>
        <Space size={6}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#94a3b8' }} />
          <Text style={{ fontSize: 12, color: '#475569' }}>Pendiente</Text>
        </Space>
      </div>

      {/* ── Gantt SVG Chart ── */}
      <Card
        bodyStyle={{ padding: 0 }}
        style={{
          overflow: 'hidden',
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div
          style={{
            width: '100%',
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: 640,
            background: '#fafbfc',
          }}
        >
          <svg
            width={totalSvgWidth}
            height={totalSvgHeight}
            style={{ display: 'block', background: '#fafbfc' }}
          >
            <defs>
              {/* Define gradient for each task */}
              {flatList.map((task, idx) => {
                const colorSet = BAR_COLORS[idx % BAR_COLORS.length]
                return (
                  <linearGradient
                    key={`grad-${task.id}`}
                    id={`barGrad-${task.id}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor={colorSet.gradient[0]} />
                    <stop offset="100%" stopColor={colorSet.gradient[1]} />
                  </linearGradient>
                )
              })}
              {/* Shadow filter */}
              <filter id="barShadow" x="-5%" y="-30%" width="110%" height="160%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.1" />
              </filter>
            </defs>

            {/* ── Header Row: Month Labels ── */}
            <rect
              x={0}
              y={0}
              width={totalSvgWidth}
              height={headerHeight}
              fill="#ffffff"
              stroke="#e2e8f0"
              strokeWidth={1}
            />

            {/* Row number column header */}
            <rect
              x={0}
              y={0}
              width={labelColumnWidth}
              height={headerHeight}
              fill="#f1f5f9"
              stroke="#e2e8f0"
              strokeWidth={1}
            />
            <text
              x={labelColumnWidth / 2}
              y={headerHeight / 2 + 5}
              textAnchor="middle"
              fill="#64748b"
              fontSize={11}
              fontWeight={700}
            >
              #
            </text>

            {/* Month column headers */}
            {months.map((month, i) => {
              const x = labelColumnWidth + (month.startDay / totalDays) * contentWidth
              const w = (month.daySpan / totalDays) * contentWidth

              return (
                <g key={`month-${i}`}>
                  <rect
                    x={x}
                    y={0}
                    width={w}
                    height={headerHeight}
                    fill="#ffffff"
                    stroke="#e2e8f0"
                    strokeWidth={1}
                  />
                  <text
                    x={x + w / 2}
                    y={headerHeight / 2 + 5}
                    textAnchor="middle"
                    fill="#334155"
                    fontSize={12}
                    fontWeight={800}
                    letterSpacing={1.5}
                  >
                    {month.label}
                  </text>
                </g>
              )
            })}

            {/* Vertical grid lines */}
            {months.map((month, i) => {
              const x = labelColumnWidth + (month.startDay / totalDays) * contentWidth
              return (
                <line
                  key={`vgrid-${i}`}
                  x1={x}
                  y1={headerHeight}
                  x2={x}
                  y2={totalSvgHeight}
                  stroke="#e8ecf0"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
              )
            })}

            {/* ── Task Rows ── */}
            {flatList.map((task, rowIndex) => {
              const y = headerHeight + rowIndex * rowHeight
              const centerY = y + rowHeight / 2
              const colorSet = BAR_COLORS[rowIndex % BAR_COLORS.length]
              const isChild = !!task.tareaPadreId

              const startX = getX(task.start)
              const endX = getX(task.end)
              const barWidth = Math.max(endX - startX, 50)
              const barHeight = 26
              const barY = centerY - barHeight / 2
              const barRadius = barHeight / 2

              const isDone = task.progress >= 100
              const dateRangeLabel = formatDateRange(task.start, task.end)
              const rowNum = String(rowIndex + 1).padStart(2, '0')

              // Descriptive text to show next to the bar
              const descText = task.responsableNombre
                ? task.responsableNombre
                : ''

              return (
                <g key={`task-${task.id}`}>
                  {/* Row background - alternating */}
                  <rect
                    x={0}
                    y={y}
                    width={totalSvgWidth}
                    height={rowHeight}
                    fill={rowIndex % 2 === 0 ? '#fafbfc' : '#ffffff'}
                  />

                  {/* Row separator line */}
                  <line
                    x1={0}
                    y1={y + rowHeight}
                    x2={totalSvgWidth}
                    y2={y + rowHeight}
                    stroke="#f0f0f0"
                    strokeWidth={1}
                  />

                  {/* Row Number */}
                  <text
                    x={labelColumnWidth / 2}
                    y={centerY + 5}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize={13}
                    fontWeight={700}
                  >
                    {rowNum}
                  </text>

                  {/* Separator line between number and chart */}
                  <line
                    x1={labelColumnWidth}
                    y1={y}
                    x2={labelColumnWidth}
                    y2={y + rowHeight}
                    stroke="#e2e8f0"
                    strokeWidth={1}
                  />

                  {/* ── Bar with rounded ends ── */}
                  <rect
                    x={startX}
                    y={barY}
                    width={barWidth}
                    height={barHeight}
                    rx={barRadius}
                    ry={barRadius}
                    fill={isDone ? '#10b981' : `url(#barGrad-${task.id})`}
                    filter="url(#barShadow)"
                    opacity={isDone ? 0.9 : 0.85}
                    style={{ cursor: 'pointer' }}
                  />

                  {/* Progress overlay (darker shade on completed portion) */}
                  {!isDone && task.progress > 0 && (
                    <rect
                      x={startX}
                      y={barY}
                      width={barWidth * (task.progress / 100)}
                      height={barHeight}
                      rx={barRadius}
                      ry={barRadius}
                      fill={colorSet.main}
                      opacity={0.95}
                      style={{ cursor: 'pointer' }}
                    />
                  )}

                  {/* Left circle indicator */}
                  <circle
                    cx={startX}
                    cy={centerY}
                    r={7}
                    fill="#ffffff"
                    stroke={isDone ? '#10b981' : colorSet.main}
                    strokeWidth={2.5}
                  />

                  {/* Right circle indicator */}
                  <circle
                    cx={startX + barWidth}
                    cy={centerY}
                    r={7}
                    fill={isDone ? '#10b981' : colorSet.main}
                    stroke={isDone ? '#10b981' : colorSet.main}
                    strokeWidth={2}
                  />

                  {/* Date range label INSIDE the bar */}
                  {barWidth > 80 && (
                    <text
                      x={startX + barWidth / 2}
                      y={centerY + 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={10}
                      fontWeight={700}
                      letterSpacing={0.5}
                      style={{ pointerEvents: 'none' }}
                    >
                      {dateRangeLabel}
                    </text>
                  )}

                  {/* Task name BEFORE the bar (left of bar) */}
                  {startX - labelColumnWidth > 60 && (
                    <text
                      x={startX - 12}
                      y={centerY + 4}
                      textAnchor="end"
                      fill="#334155"
                      fontSize={11}
                      fontWeight={isChild ? 500 : 700}
                      style={{ pointerEvents: 'none' }}
                    >
                      {task.name.length > 30 ? task.name.substring(0, 28) + '…' : task.name}
                    </text>
                  )}

                  {/* Task name AFTER the bar (if no room on left) */}
                  {startX - labelColumnWidth <= 60 && (
                    <text
                      x={startX + barWidth + 20}
                      y={centerY - 4}
                      textAnchor="start"
                      fill="#334155"
                      fontSize={11}
                      fontWeight={isChild ? 500 : 700}
                      style={{ pointerEvents: 'none' }}
                    >
                      {task.name.length > 35 ? task.name.substring(0, 33) + '…' : task.name}
                    </text>
                  )}

                  {/* Description/Responsable text after bar */}
                  {descText && (
                    <text
                      x={startX + barWidth + 20}
                      y={startX - labelColumnWidth <= 60 ? centerY + 10 : centerY + 4}
                      textAnchor="start"
                      fill="#94a3b8"
                      fontSize={10}
                      fontStyle="italic"
                      style={{ pointerEvents: 'none' }}
                    >
                      {descText}
                    </text>
                  )}

                  {/* Progress badge for completed tasks */}
                  {isDone && (
                    <g transform={`translate(${startX + barWidth + 16}, ${centerY - 8})`}>
                      <rect x={0} y={0} width={22} height={16} rx={8} fill="#d1fae5" stroke="#10b981" strokeWidth={1} />
                      <text x={11} y={12} textAnchor="middle" fill="#047857" fontSize={9} fontWeight={800}>
                        ✓
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </Card>

      {/* ── Task Detail Table Below Chart ── */}
      <Card
        title={
          <Text style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
            Detalle de Tareas del Diagrama
          </Text>
        }
        bodyStyle={{ padding: 0 }}
        style={{
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thStyle}>#</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Tarea</th>
                <th style={thStyle}>Responsable</th>
                <th style={thStyle}>Inicio</th>
                <th style={thStyle}>Fin</th>
                <th style={thStyle}>Avance</th>
                <th style={thStyle}>Presupuesto</th>
                <th style={thStyle}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {flatList.map((task, idx) => {
                const colorSet = BAR_COLORS[idx % BAR_COLORS.length]
                const isDone = task.progress >= 100
                const statusLabel = isDone ? 'Completada' : task.progress > 0 ? 'En Curso' : 'Pendiente'
                const statusColor = isDone ? '#10b981' : task.progress > 0 ? '#3498db' : '#94a3b8'

                return (
                  <tr
                    key={task.id}
                    style={{
                      borderBottom: '1px solid #f0f0f0',
                      background: idx % 2 === 0 ? '#ffffff' : '#fafbfc',
                    }}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#94a3b8' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'left' }}>
                      <Space size={8}>
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: colorSet.main,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontWeight: task.tareaPadreId ? 400 : 600, color: '#1e293b' }}>
                          {task.tareaPadreId ? `  └ ${task.name}` : task.name}
                        </span>
                      </Space>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#475569' }}>
                      {task.responsableNombre ?? '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#475569', fontSize: 12 }}>
                      {task.start}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#475569', fontSize: 12 }}>
                      {task.end}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <Progress
                        percent={task.progress}
                        size="small"
                        strokeColor={statusColor}
                        style={{ width: 80, margin: '0 auto' }}
                        format={() => `${task.progress}%`}
                      />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
                      {formatCurrency(task.presupuestoEstimado)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <Tag
                        color={isDone ? 'success' : task.progress > 0 ? 'processing' : 'default'}
                        style={{ fontSize: 11, borderRadius: 12 }}
                      >
                        {statusLabel}
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
