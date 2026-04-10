import { useState, useCallback, useEffect, useRef } from 'react'
import { Room, RoomEvent, RemoteParticipant } from 'livekit-client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type GetToken = () => Promise<string | null>

async function authHeaders(getToken: GetToken): Promise<HeadersInit> {
  const token = await getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function useVoiceSession(topicId: string, userId: string, getToken: GetToken) {
  // Use a ref to hold the Room so it doesn't trigger re-renders and survives them
  const roomRef = useRef<Room | null>(null)
  if (!roomRef.current) roomRef.current = new Room()
  const room = roomRef.current

  const [isConnected, setIsConnected] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [participants, setParticipants] = useState<RemoteParticipant[]>([])
  const [handRaised, setHandRaised] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [participantCount, setParticipantCount] = useState(0)

  useEffect(() => {
    const updateParticipants = () =>
      setParticipants(Array.from(room.remoteParticipants.values()))

    room.on(RoomEvent.ParticipantConnected, updateParticipants)
    room.on(RoomEvent.ParticipantDisconnected, updateParticipants)
    room.on(RoomEvent.ParticipantConnected, () =>
      setParticipantCount(room.remoteParticipants.size + 1))
    room.on(RoomEvent.ParticipantDisconnected, () =>
      setParticipantCount(room.remoteParticipants.size + 1))
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) =>
      setIsSpeaking(speakers.some(s => s.identity === userId)))

    return () => {
      room.removeAllListeners()
      // Disconnect on unmount if still connected to avoid mic/socket leaks
      if (room.state !== 'disconnected') {
        void room.disconnect()
      }
    }
  }, [room, userId])

  const startSession = useCallback(async (communityId: string) => {
    const headers = await authHeaders(getToken)
    const res = await fetch(`${API_URL}/api/topics/${topicId}/voice/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ communityId }),
    })
    if (!res.ok) throw new Error(`Failed to start voice session: ${res.status}`)
    const data = await res.json() as { token: string; livekitUrl: string; sessionId: string }
    await room.connect(data.livekitUrl, data.token)
    await room.localParticipant.setMicrophoneEnabled(true)
    setIsConnected(true)
    setIsHost(true)
    setSessionId(data.sessionId)
    setParticipantCount(1)
  }, [room, topicId, getToken])

  const joinSession = useCallback(async () => {
    const headers = await authHeaders(getToken)
    const res = await fetch(`${API_URL}/api/topics/${topicId}/voice/join`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    })
    if (!res.ok) throw new Error(`Failed to join voice session: ${res.status}`)
    const data = await res.json() as { token: string; livekitUrl: string; sessionId: string }
    await room.connect(data.livekitUrl, data.token)
    setIsConnected(true)
    setIsHost(false)
    setSessionId(data.sessionId)
  }, [room, topicId, getToken])

  const leaveSession = useCallback(async () => {
    // Notify the API to decrement participantCount before disconnecting
    try {
      const headers = await authHeaders(getToken)
      await fetch(`${API_URL}/api/topics/${topicId}/voice/leave`, { method: 'POST', headers })
    } catch { /* best-effort — session end will reconcile the count anyway */ }
    await room.disconnect()
    setIsConnected(false)
    setIsHost(false)
    setSessionId(null)
    setParticipantCount(0)
  }, [room, topicId, getToken])

  const toggleMute = useCallback(async () => {
    const next = !isMuted
    await room.localParticipant.setMicrophoneEnabled(!next)
    setIsMuted(next)
  }, [room, isMuted])

  const raiseHand = useCallback(async (userName: string) => {
    if (!sessionId) return
    const headers = await authHeaders(getToken)
    await fetch(`${API_URL}/api/voice/${sessionId}/request-speak`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userName }),
    })
    setHandRaised(true)
  }, [sessionId, getToken])

  return {
    isConnected, isHost, isMuted, isSpeaking, participants,
    handRaised, sessionId, participantCount,
    startSession, joinSession, leaveSession, toggleMute, raiseHand,
  }
}
