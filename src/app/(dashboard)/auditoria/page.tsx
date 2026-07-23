'use client'

import React from 'react'
import { Typography } from 'antd'
import AuditoriaTable from '@/components/AuditoriaTable'

const { Title, Text } = Typography

export default function AuditoriaPage() {
  return (
    <div>
      <div
        className="responsive-page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Auditoría
          </Title>
          <Text type="secondary">
            Registro de actividades y operaciones de usuarios en el sistema
          </Text>
        </div>
      </div>

      <AuditoriaTable />
    </div>
  )
}
