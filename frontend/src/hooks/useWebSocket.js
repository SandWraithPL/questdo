import { useEffect, useRef, useState } from 'react'

const API_WS = (import.meta.env.VITE_API_URL || "http://localhost:8000")
  .replace("https://", "wss://")
  .replace("http://", "ws://") + "/ws"

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const ws = useRef(null)

  useEffect(() => {
    ws.current = new WebSocket(API_WS)
    
    ws.current.onopen = () => {
      console.log('[WS] Connected')
      setIsConnected(true)
    }
    
    ws.current.onclose = () => {
      console.log('[WS] Disconnected')
      setIsConnected(false)
      // Reconnect after 3 seconds
      setTimeout(() => {
        ws.current = new WebSocket(API_WS)
      }, 3000)
    }
    
    ws.current.onerror = (error) => {
      console.error('[WS] Error:', error)
    }

    return () => {
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [])

  const send = (data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data))
    }
  }

  return { isConnected, send, ws: ws.current }
}
