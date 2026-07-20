'use client'

import React, { useState, useEffect } from 'react'
import { Spin, Alert } from 'antd'
import DashboardCharts from '@/components/DashboardCharts'
import type { DashboardResponse } from '@/types'

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        const res = await fetch('/api/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.status === 401) {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_user')
          window.location.href = '/login'
          return
        }

        if (!res.ok) throw new Error('Error al obtener datos del dashboard')

        const json = await res.json()
        setData(json)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al cargar dashboard')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !data) {
    return <Alert title="Error" description={error ?? 'Error al cargar dashboard'} type="error" showIcon />
  }

  return <DashboardCharts data={data} />
}
