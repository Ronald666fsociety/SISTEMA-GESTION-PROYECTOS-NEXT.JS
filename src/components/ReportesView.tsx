'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  Card,
  Select,
  Button,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Typography,
  Spin,
  Alert,
  Space,
  Tabs,
} from 'antd'
import {
  WalletOutlined,
  PieChartOutlined,
  TeamOutlined,
  ScheduleOutlined,
} from '@ant-design/icons'
import GanttChart from '@/components/GanttChart'

const { Title, Text } = Typography
const { Option } = Select

// ── Register Chart.js components synchronously ──

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, ChartTitle)

// ── Dynamic chart imports ──
const Bar = dynamic(
  () => import('react-chartjs-2').then((mod) => mod.Bar),
  { ssr: false }
)

const Doughnut = dynamic(
  () => import('react-chartjs-2').then((mod) => mod.Doughnut),
  { ssr: false }
)

const CHART_COLORS = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2']

interface PresupuestoItem {
  proyectoId: number
  proyecto: string
  presupuesto: number
  costoReal: number
  diferencia: number
  estado: 'DENTRO_PRESUPUESTO' | 'SOBRE_PRESUPUESTO'
}

interface SemaforoItem {
  proyectoId: number
  proyecto: string
  avanceReal: number
  avancePlanificado: number
  retrasoPorcentaje: number
  sobreCostoPorcentaje: number
  color: 'VERDE' | 'AMARILLO' | 'ROJO'
}

interface CargaTrabajoItem {
  usuario: string
  totalHorasEstimadas: number
  totalHorasReales: number
  tareas: string[]
}

interface ProyectoOption {
  id: number
  nombre: string
}

interface UsuarioOption {
  id: number
  nombre: string
}

export default function ReportesView() {
  const [proyectos, setProyectos] = useState<ProyectoOption[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([])

  // Presupuesto vs Costo
  const [presupuestoData, setPresupuestoData] = useState<PresupuestoItem[]>([])
  const [presupuestoLoading, setPresupuestoLoading] = useState(false)

  // Semáforo
  const [semaforoData, setSemaforoData] = useState<SemaforoItem[]>([])
  const [semaforoLoading, setSemaforoLoading] = useState(false)
  const [selectedProyectoSemaforo, setSelectedProyectoSemaforo] = useState<number | undefined>()

  // Carga de Trabajo
  const [cargaData, setCargaData] = useState<CargaTrabajoItem[]>([])
  const [cargaLoading, setCargaLoading] = useState(false)
  const [selectedUsuario, setSelectedUsuario] = useState<number | undefined>()

  // Gantt
  const [selectedGanttProyecto, setSelectedGanttProyecto] = useState<number | undefined>()

  // Fetch initial data
  useEffect(() => {
    const token = localStorage.getItem('auth_token')

    fetch('/api/proyectos', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setProyectos(data)
        if (Array.isArray(data) && data.length > 0) {
          setSelectedGanttProyecto(data[0].id)
          setSelectedProyectoSemaforo(data[0].id)
        }
      })
      .catch(() => {})

    fetch('/api/usuarios', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setUsuarios(data))
      .catch(() => {})

    // Load presupuesto report by default
    loadPresupuesto()
    loadSemaforo()
  }, [])

  const loadPresupuesto = async () => {
    setPresupuestoLoading(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch('/api/reportes/presupuesto-vs-costo', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setPresupuestoData(await res.json())
      }
    } catch {
      // ignore
    } finally {
      setPresupuestoLoading(false)
    }
  }

  const loadSemaforo = async () => {
    setSemaforoLoading(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch('/api/reportes/semaforo', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setSemaforoData(await res.json())
      }
    } catch {
      // ignore
    } finally {
      setSemaforoLoading(false)
    }
  }

  const loadCargaTrabajo = async (usuarioId?: number) => {
    setCargaLoading(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch('/api/reportes/carga-trabajo', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setCargaData(await res.json())
      }
    } catch {
      // ignore
    } finally {
      setCargaLoading(false)
    }
  }

  // ── Selected project for presupuesto ──
  const selectedPresupuesto = presupuestoData.find(
    (p) => p.proyectoId === selectedProyectoSemaforo
  )

  const selectedSemaforoItem = semaforoData.find(
    (s) => s.proyectoId === selectedProyectoSemaforo
  )

  // ── Bar chart: presupuesto vs costo ──
  const presupuestoBarData = {
    labels: presupuestoData.map((p) => p.proyecto),
    datasets: [
      {
        label: 'Presupuesto',
        data: presupuestoData.map((p) => p.presupuesto),
        backgroundColor: CHART_COLORS[0],
        borderRadius: 4,
      },
      {
        label: 'Costo Real',
        data: presupuestoData.map((p) => p.costoReal),
        backgroundColor: CHART_COLORS[2],
        borderRadius: 4,
      },
    ],
  }

  const presupuestoColumns = [
    {
      title: '#',
      key: 'index',
      width: 50,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    { title: 'Proyecto', dataIndex: 'proyecto', key: 'proyecto' },
    {
      title: 'Presupuesto',
      dataIndex: 'presupuesto',
      key: 'presupuesto',
      align: 'right' as const,
      render: (v: number) => 'Bs ' + Number(v).toFixed(2),
    },
    {
      title: 'Costo Real',
      dataIndex: 'costoReal',
      key: 'costoReal',
      align: 'right' as const,
      render: (v: number) => 'Bs ' + Number(v).toFixed(2),
    },
    {
      title: 'Diferencia',
      dataIndex: 'diferencia',
      key: 'diferencia',
      align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {v >= 0 ? '+' : ''}
          {'Bs ' + Number(v).toFixed(2)}
        </Text>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      render: (estado: string) => (
        <Tag color={estado === 'DENTRO_PRESUPUESTO' ? 'green' : 'red'}>
          {estado === 'DENTRO_PRESUPUESTO'
            ? 'Dentro del Presupuesto'
            : 'Sobre Presupuesto'}
        </Tag>
      ),
    },
  ]

  // ── Semáforo Configuration ──
  const SEMAFORO_CONFIG = {
    VERDE: {
      label: 'ÓPTIMO',
      sublabel: 'Proyecto al día',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      color: '#15803d',
      dot: '#22c55e',
      glow: 'rgba(34, 197, 94, 0.3)',
      chartColor: '#22c55e',
    },
    AMARILLO: {
      label: 'ATENCIÓN',
      sublabel: 'Desviación moderada',
      bg: '#fffbeb',
      border: '#fde68a',
      color: '#b45309',
      dot: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.3)',
      chartColor: '#f59e0b',
    },
    ROJO: {
      label: 'RIESGO CRÍTICO',
      sublabel: 'Desviación grave',
      bg: '#fef2f2',
      border: '#fecaca',
      color: '#b91c1c',
      dot: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.3)',
      chartColor: '#ef4444',
    },
  }

  const semaforoDoughnutData = selectedSemaforoItem
    ? {
        labels: ['Avance Real', 'Restante'],
        datasets: [
          {
            data: [selectedSemaforoItem.avanceReal, Math.max(0, 100 - selectedSemaforoItem.avanceReal)],
            backgroundColor: [
              SEMAFORO_CONFIG[selectedSemaforoItem.color]?.chartColor ?? '#22c55e',
              '#f1f5f9',
            ],
            borderWidth: 0,
          },
        ],
      }
    : null

  // ── Filtered Carga de trabajo ──
  const filteredCargaData = selectedUsuario
    ? cargaData.filter((c) => {
        const u = usuarios.find((usr) => usr.id === selectedUsuario)
        return u ? c.usuario === u.nombre : true
      })
    : cargaData

  // ── Carga de trabajo bar chart ──
  const cargaBarData = {
    labels: filteredCargaData.map((c) => c.usuario),
    datasets: [
      {
        label: 'Horas Estimadas',
        data: filteredCargaData.map((c) => c.totalHorasEstimadas),
        backgroundColor: CHART_COLORS[0],
        borderRadius: 4,
      },
      {
        label: 'Horas Reales',
        data: filteredCargaData.map((c) => c.totalHorasReales),
        backgroundColor: CHART_COLORS[1],
        borderRadius: 4,
      },
    ],
  }

  const cargaColumns = [
    {
      title: '#',
      key: 'index',
      width: 50,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    { title: 'Usuario', dataIndex: 'usuario', key: 'usuario' },
    {
      title: 'Horas Est.',
      dataIndex: 'totalHorasEstimadas',
      key: 'totalHorasEstimadas',
      align: 'right' as const,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: 'Horas Reales',
      dataIndex: 'totalHorasReales',
      key: 'totalHorasReales',
      align: 'right' as const,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: 'Tareas Asignadas',
      dataIndex: 'tareas',
      key: 'tareas',
      render: (tareas: string[]) => tareas.join(', '),
    },
  ]

  return (
    <Row gutter={[24, 24]}>
        {/* ── Diagrama de Gantt del Proyecto ── */}
        <Col xs={24}>
          <Card
            title={
              <Space align="center">
                <ScheduleOutlined style={{ color: '#2563eb' }} />
                <span>Diagrama de Gantt del Proyecto</span>
              </Space>
            }
            extra={
              <Space align="center">
                <Text style={{ fontSize: 13 }}>Seleccionar Proyecto:</Text>
                <Select
                  placeholder="Seleccionar proyecto"
                  value={selectedGanttProyecto}
                  onChange={setSelectedGanttProyecto}
                  style={{ width: 240 }}
                  showSearch
                  optionFilterProp="children"
                >
                  {proyectos.map((p) => (
                    <Option key={p.id} value={p.id}>
                      {p.nombre}
                    </Option>
                  ))}
                </Select>
              </Space>
            }
          >
            {selectedGanttProyecto ? (
              <GanttChart proyectoId={selectedGanttProyecto} />
            ) : (
              <Alert title="Seleccione un proyecto para visualizar su Diagrama de Gantt" type="info" showIcon />
            )}
          </Card>
        </Col>

        {/* ── Presupuesto vs Costo ── */}
        <Col xs={24}>
          <Card
            title={
              <Space>
                <WalletOutlined />
                <span>Presupuesto vs Costo</span>
              </Space>
            }
            extra={
              <Button onClick={loadPresupuesto} loading={presupuestoLoading}>
                Consultar
              </Button>
            }
          >
            {presupuestoLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin />
              </div>
            ) : presupuestoData.length === 0 ? (
              <Alert title="No hay datos disponibles" type="info" showIcon />
            ) : (
              <>
                <div style={{ maxHeight: 300, marginBottom: 24 }}>
                  <Bar data={presupuestoBarData} options={{ responsive: true, plugins: { legend: { position: 'bottom' as const } } }} />
                </div>
                <Table
                  dataSource={presupuestoData}
                  columns={presupuestoColumns}
                  rowKey="proyectoId"
                  pagination={false}
                  size="small"
                  bordered
                />
              </>
            )}
          </Card>
        </Col>

        {/* ── Semáforo ── */}
        <Col xs={24}>
          <Card
            title={
              <Space>
                <PieChartOutlined />
                <span>Semáforo de Proyectos</span>
              </Space>
            }
            extra={
              <Button onClick={loadSemaforo} loading={semaforoLoading}>
                Consultar
              </Button>
            }
          >
            {semaforoLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin />
              </div>
            ) : semaforoData.length === 0 ? (
              <Alert title="No hay datos disponibles" type="info" showIcon />
            ) : (
              <Row gutter={24}>
                <Col xs={24} md={8}>
                  <Select
                    placeholder="Seleccionar proyecto"
                    value={selectedProyectoSemaforo}
                    onChange={setSelectedProyectoSemaforo}
                    style={{ width: '100%' }}
                    showSearch
                    optionFilterProp="children"
                  >
                    {semaforoData.map((s) => (
                      <Option key={s.proyectoId} value={s.proyectoId}>
                        {s.proyecto}
                      </Option>
                    ))}
                  </Select>

                  {selectedSemaforoItem && (
                    <div style={{ marginTop: 20 }}>
                      {/* Premium Status Badge */}
                      {(() => {
                        const cfg = SEMAFORO_CONFIG[selectedSemaforoItem.color] ?? SEMAFORO_CONFIG.VERDE
                        return (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '12px 18px',
                              borderRadius: 16,
                              background: cfg.bg,
                              border: `1px solid ${cfg.border}`,
                              boxShadow: `0 4px 16px -2px ${cfg.glow}`,
                              marginBottom: 20,
                            }}
                          >
                            <div
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: cfg.dot,
                                boxShadow: `0 0 10px ${cfg.dot}`,
                                flexShrink: 0,
                              }}
                            />
                            <div>
                              <div style={{ color: cfg.color, fontWeight: 800, fontSize: 14, letterSpacing: '0.5px' }}>
                                {cfg.label} ({selectedSemaforoItem.color})
                              </div>
                              <div style={{ color: cfg.color, fontSize: 12, opacity: 0.85, fontWeight: 500 }}>
                                {cfg.sublabel}
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Clean Metric Cards Grid */}
                      <Row gutter={[10, 10]}>
                        <Col span={8}>
                          <div style={{ background: '#f8fafc', padding: '12px 6px', borderRadius: 12, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Avance Real</Text>
                            <Text strong style={{ fontSize: 17, color: '#0f172a' }}>{selectedSemaforoItem.avanceReal}%</Text>
                          </div>
                        </Col>
                        <Col span={8}>
                          <div style={{ background: '#f8fafc', padding: '12px 6px', borderRadius: 12, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Planificado</Text>
                            <Text strong style={{ fontSize: 17, color: '#0f172a' }}>{selectedSemaforoItem.avancePlanificado}%</Text>
                          </div>
                        </Col>
                        <Col span={8}>
                          <div style={{ background: '#f8fafc', padding: '12px 6px', borderRadius: 12, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Retraso</Text>
                            <Text strong style={{ fontSize: 17, color: selectedSemaforoItem.retrasoPorcentaje > 0 ? '#ef4444' : '#10b981' }}>
                              {selectedSemaforoItem.retrasoPorcentaje}%
                            </Text>
                          </div>
                        </Col>
                      </Row>
                    </div>
                  )}
                </Col>
                <Col xs={24} md={16}>
                  {semaforoDoughnutData && (
                    <div style={{ maxHeight: 300 }}>
                      <Doughnut
                        data={semaforoDoughnutData}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { position: 'bottom' as const },
                          },
                        }}
                      />
                    </div>
                  )}
                </Col>
              </Row>
            )}
          </Card>
        </Col>

        {/* ── Carga de Trabajo ── */}
        <Col xs={24}>
          <Card
            title={
              <Space>
                <TeamOutlined />
                <span>Carga de Trabajo</span>
              </Space>
            }
            extra={
              <Space>
                <Select
                  placeholder="Filtrar por usuario"
                  value={selectedUsuario}
                  onChange={setSelectedUsuario}
                  allowClear
                  style={{ width: 200 }}
                  showSearch
                  optionFilterProp="children"
                >
                  {usuarios.map((u) => (
                    <Option key={u.id} value={u.id}>
                      {u.nombre}
                    </Option>
                  ))}
                </Select>
                <Button onClick={() => loadCargaTrabajo()} loading={cargaLoading}>
                  Consultar
                </Button>
              </Space>
            }
          >
            {cargaLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin />
              </div>
            ) : filteredCargaData.length === 0 ? (
              <Alert title="No hay datos de carga de trabajo" type="info" showIcon />
            ) : (
              <>
                <div style={{ maxHeight: 300, marginBottom: 24 }}>
                  <Bar
                    data={cargaBarData}
                    options={{
                      responsive: true,
                      indexAxis: 'y' as const,
                      plugins: { legend: { position: 'bottom' as const } },
                    }}
                  />
                </div>
                <Table
                  dataSource={filteredCargaData}
                  columns={cargaColumns}
                  rowKey="usuario"
                  pagination={false}
                  size="small"
                  bordered
                />
              </>
            )}
          </Card>
        </Col>
      </Row>
  )
}
