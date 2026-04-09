'use client'

import type { RemoteParticipant } from 'livekit-client'

interface Props {
  isConnected: boolean
  isMuted: boolean
  isSpeaking: boolean
  participants: RemoteParticipant[]
  handRaised: boolean
  participantCount: number
  isHost: boolean
  userName: string
  onLeave: () => void
  onToggleMute: () => void
  onRaiseHand: () => void
}

export function VoiceSessionBar({
  isConnected,
  isMuted,
  isSpeaking,
  participants,
  handRaised,
  participantCount,
  isHost,
  userName,
  onLeave,
  onToggleMute,
  onRaiseHand,
}: Props) {
  if (!isConnected) return null

  return (
    <div style={{
      background: 'rgba(10,16,30,.96)',
      borderBottom: '1px solid rgba(255,255,255,.1)',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      backdropFilter: 'blur(10px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      {/* Dot ao vivo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#ef4444',
          animation: 'pulse 1.5s infinite',
          display: 'inline-block',
        }} />
        <span style={{ fontSize: 13, color: '#F0F4FA', fontWeight: 500 }}>Ao vivo</span>
      </div>

      {/* Avatares */}
      <div style={{ display: 'flex' }}>
        {participants.slice(0, 3).map((p, i) => (
          <div key={p.identity} style={{
            width: 28, height: 28, borderRadius: '50%',
            background: '#4A9EFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: '#fff', fontWeight: 600,
            marginLeft: i > 0 ? -8 : 0,
            border: '2px solid rgba(10,16,30,.96)',
          }}>
            {p.identity[0]?.toUpperCase()}
          </div>
        ))}
      </div>

      {/* Contador */}
      <span style={{ fontSize: 13, color: '#6B8BAF' }}>
        {participantCount} ouvindo
      </span>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {/* Botão mudo */}
        <button onClick={onToggleMute} style={{
          padding: '4px 12px', borderRadius: 6, fontSize: 13,
          background: isMuted ? 'rgba(239,68,68,.2)' : 'rgba(255,255,255,.08)',
          border: '1px solid rgba(255,255,255,.15)',
          color: '#F0F4FA', cursor: 'pointer',
        }}>
          {isMuted ? '🔇 Mudo' : '🎤 Ativo'}
        </button>

        {/* Botão pedir fala (apenas não-host) */}
        {!isHost && (
          <button onClick={onRaiseHand} style={{
            padding: '4px 12px', borderRadius: 6, fontSize: 13,
            background: isSpeaking
              ? 'rgba(34,201,138,.2)'
              : handRaised
              ? 'rgba(74,158,255,.2)'
              : 'rgba(255,255,255,.08)',
            border: `1px solid ${isSpeaking ? '#22C98A' : 'rgba(255,255,255,.15)'}`,
            color: '#F0F4FA', cursor: 'pointer',
          }}>
            {isSpeaking ? '🎤 Falando' : handRaised ? '✋ Aguardando' : '✋ Pedir fala'}
          </button>
        )}

        {/* Sair */}
        <button onClick={onLeave} style={{
          padding: '4px 12px', borderRadius: 6, fontSize: 13,
          background: 'rgba(255,255,255,.08)',
          border: '1px solid rgba(255,255,255,.15)',
          color: '#F0F4FA', cursor: 'pointer',
        }}>
          Sair
        </button>

        {/* Encerrar (host) */}
        {isHost && (
          <button onClick={onLeave} style={{
            padding: '4px 12px', borderRadius: 6, fontSize: 13,
            background: 'rgba(239,68,68,.2)',
            border: '1px solid rgba(239,68,68,.4)',
            color: '#ef4444', cursor: 'pointer',
          }}>
            Encerrar sessão
          </button>
        )}
      </div>
    </div>
  )
}
