'use client'

import React, { useState } from 'react'
import { createCache, extractStyle, StyleProvider } from '@ant-design/cssinjs'
import type Entity from '@ant-design/cssinjs/lib/Cache'
import { useServerInsertedHTML } from 'next/navigation'

export default function AntdRegistry({ children }: { children: React.ReactNode }) {
  const [cache] = useState<Entity>(() => createCache())
  const isServerInserted = React.useRef(false)

  useServerInsertedHTML(() => {
    if (isServerInserted.current) {
      return null
    }
    isServerInserted.current = true
    return (
      <style
        id="antd"
        dangerouslySetInnerHTML={{ __html: extractStyle(cache, true) }}
      />
    )
  })

  return <StyleProvider cache={cache}>{children}</StyleProvider>
}
