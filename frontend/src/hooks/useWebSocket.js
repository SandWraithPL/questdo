import { useEffect, useRef, useState } from 'react'

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"
const API_WS = API.replace("https://", "wss://").replace("http://", "ws://") + "/ws"

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const ws = useRef(null)

  useEffect(() => {
    ws.current = new WebSocket(API_WS)

    ws.current.onopen = () => {
      setIsConnected(true)
    }

    ws.current.onclose = () => {
      setIsConnected(false)

      setTimeout(() => {
        ws.current = new WebSocket(API_WS)
      }, 3000)
    }

    ws.current.onerror = () => {}

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
