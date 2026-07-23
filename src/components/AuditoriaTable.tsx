'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Select,
  Input,
  Button,
  Space,
  Tag,
  DatePicker,
  Typography,
  Spin,
  Alert,
  message,
} from 'antd'
import { SearchOutlined, ClearOutlined, UserOutlined, GlobalOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { Auditoria, PaginatedResponse, Usuario } from '@/types'
import type { Dayjs } from 'dayjs'

const { Text } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

const ACCION_COLORS: Record<string, string> = {
  CREAR: 'green',
  ACTUALIZAR: 'blue',
  ELIMINAR: 'red',
}

const ACCION_LABELS: Record<string, string> = {
  CREAR: 'Creación',
  ACTUALIZAR: 'Actualización',
  ELIMINAR: 'Eliminación',
}

export default function AuditoriaTable() {
  const [data, setData] = useState<Auditoria[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(100)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters (Entidad and ID Entidad removed per user request)
  const [usuarioId, setUsuarioId] = useState<string>('')
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)

  // Fetch users for filter dropdown
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    fetch('/api/usuarios', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setUsuarios(data))
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async (p: number = page) => {
    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('auth_token')
      const params = new URLSearchParams()
      params.set('page', String(p))
      params.set('limit', String(limit))

      if (usuarioId) params.set('usuarioId', usuarioId)
      if (dateRange?.[0]) params.set('fechaDesde', dateRange[0].startOf('day').toISOString())
      if (dateRange?.[1]) params.set('fechaHasta', dateRange[1].endOf('day').toISOString())

      const res = await fetch(`/api/auditoria?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_user')
          window.location.href = '/login'
          return
        }
        if (res.status === 403) {
          throw new Error('Acceso denegado. Solo administradores pueden ver auditoría.')
        }
        throw new Error('Error al cargar auditoría')
      }

      const result: PaginatedResponse<Auditoria> = await res.json()
      setData(result.data)
      setTotal(result.total)
      setPage(result.page)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [usuarioId, dateRange, limit, page])

  useEffect(() => {
    fetchData(1)
  }, [])

  const handleFilter = () => {
    setPage(1)
    fetchData(1)
  }

  const handleClear = () => {
    setUsuarioId('')
    setDateRange(null)
    setPage(1)
    fetchData(1)
  }

  const handleExportPDF = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const params = new URLSearchParams()
      if (usuarioId) params.set('usuarioId', usuarioId)
      if (dateRange?.[0]) params.set('fechaDesde', dateRange[0].startOf('day').toISOString())
      if (dateRange?.[1]) params.set('fechaHasta', dateRange[1].endOf('day').toISOString())

      const res = await fetch(`/api/exportar/pdf/auditoria?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) throw new Error('Error al exportar PDF')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'reporte-auditoria.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Error al generar el reporte PDF')
    }
  }

  const handleTableChange = (pagination: { current?: number }) => {
    const newPage = pagination.current ?? 1
    setPage(newPage)
    fetchData(newPage)
  }

  const columns = [
    {
      title: '#',
      key: 'index',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => (page - 1) * limit + index + 1,
    },
    {
      title: 'Fecha y Hora',
      dataIndex: 'fecha',
      key: 'fecha',
      width: 170,
      render: (fecha: string) => {
        const d = new Date(fecha)
        return `${d.toLocaleDateString('es-BO')} ${d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`
      },
    },
    {
      title: 'Usuario',
      dataIndex: 'nombreUsuario',
      key: 'nombreUsuario',
      width: 180,
      render: (nombre: string) => (
        <Space size={6}>
          <UserOutlined style={{ color: '#1677ff' }} />
          <Text strong>{nombre ?? 'Sistema'}</Text>
        </Space>
      ),
    },
    {
      title: 'Dirección IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 150,
      render: (ip?: string) => (
        <Tag icon={<GlobalOutlined />} color="cyan" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
          {ip ?? '127.0.0.1'}
        </Tag>
      ),
    },
    {
      title: 'Actividad / Descripción',
      key: 'actividad',
      render: (_: unknown, record: Auditoria) => {
        const desc = record.detalle ?? `${ACCION_LABELS[record.accion] ?? record.accion} en ${record.entidad} #${record.entidadId}`
        return <Text>{desc}</Text>
      },
    },
    {
      title: 'Acción',
      dataIndex: 'accion',
      key: 'accion',
      width: 130,
      align: 'center' as const,
      render: (accion: string) => (
        <Tag color={ACCION_COLORS[accion] ?? 'default'} style={{ borderRadius: 10, padding: '2px 10px' }}>
          {ACCION_LABELS[accion] ?? accion}
        </Tag>
      ),
    },
  ]

  return (
    <div>
      {/* ── Filter bar (simplified per user request) ── */}
      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }} size="middle">
        <Select
          placeholder="Filtrar por Usuario"
          value={usuarioId || undefined}
          onChange={(val) => setUsuarioId(val ? String(val) : '')}
          allowClear
          style={{ width: 220 }}
          showSearch
          optionFilterProp="children"
        >
          {usuarios.map((u) => (
            <Option key={u.id} value={String(u.id)}>
              {u.nombre} ({u.rol})
            </Option>
          ))}
        </Select>

        <RangePicker
          value={dateRange as any}
          onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
        />

        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={handleFilter}
        >
          Buscar
        </Button>

        <Button icon={<ClearOutlined />} onClick={handleClear}>
          Limpiar
        </Button>

        <Button icon={<FilePdfOutlined />} onClick={handleExportPDF}>
          Reporte PDF
        </Button>
      </Space>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert title="Error" description={error} type="error" showIcon />
      ) : (
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showTotal: (totalCount: number) =>
              `Total: ${totalCount} actividad${totalCount !== 1 ? 'es' : ''}`,
          }}
          onChange={handleTableChange as any}
          size="middle"
          bordered
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: 'No se encontraron registros de auditoría',
          }}
        />
      )}
    </div>
  )
}
