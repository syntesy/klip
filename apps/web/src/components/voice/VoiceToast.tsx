'use client'

import { useEffect } from 'react'

interface Props {
  hostName: string
  topicName: string
  onJoin: () => void
  onDismiss: () => void
}

export function VoiceToast({ hostName, topicName, onJoin, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 1000,
      background: '#0D1525',
      border: '1px solid rgba(74,158,255,.3)',
      borderRadius: 10, padding: '14px 18px',
      display: 'flex', flexDirection: 'column', gap: 8,
      minWidth: 280, boxShadow: '0 8px 32px rgba(0,0,0,.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#ef4444', display: 'inline-block',
          animation: 'pulse 1.5s infinite',
        }} />
        <span style={{ color: '#F0F4FA', fontSize: 13, fontWeight: 600 }}>
          {hostName} iniciou um áudio ao vivo
        </span>
        <button onClick={onDismiss} style={{
          marginLeft: 'auto', background: 'none', border: 'none',
          color: '#6B8BAF', cursor: 'pointer', fontSize: 16, lineHeight: 1,
        }}>×</button>
      </div>
      <span style={{ color: '#6B8BAF', fontSize: 12 }}>{topicName}</span>
      <button onClick={onJoin} style={{
        background: 'rgba(74,158,255,.2)',
        border: '1px solid rgba(74,158,255,.4)',
        borderRadius: 6, padding: '6px 14px',
        color: '#4A9EFF', fontSize: 13, fontWeight: 500,
        cursor: 'pointer', alignSelf: 'flex-start',
      }}>
        Entrar
      </button>
    </div>
  )
}
