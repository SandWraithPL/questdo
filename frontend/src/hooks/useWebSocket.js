// Importy React i referencji do DOM
import { useEffect, useRef, useState } from 'react'

// URL do API - konwertujemy http na ws
const API = import.meta.env.VITE_API_URL || "http://localhost:8000"
const API_WS = API.replace("https://", "wss://").replace("http://", "ws://") + "/ws"

// Hook do zarządzania WebSocket połączeniem
export function useWebSocket() {
  // Stan czy jesteśmy połączeni z serwerem
  const [isConnected, setIsConnected] = useState(false)
  // Referencja do WebSocket obiektu
  const ws = useRef(null)

  useEffect(() => {
    // Tworzymy nowe WebSocket połączenie
    ws.current = new WebSocket(API_WS)

    // Gdy połączenie się nawiąże
    ws.current.onopen = () => {
      setIsConnected(true)
    }

    // Gdy połączenie się zamknie
    ws.current.onclose = () => {
      setIsConnected(false)

      // Po 3 sekundach próbujemy się ponownie połączyć
      setTimeout(() => {
        ws.current = new WebSocket(API_WS)
      }, 3000)
    }

    // Obsługujemy błędy połączenia
    ws.current.onerror = () => {}

    // Czyszczenie - zamykamy połączenie gdy komponent się unmountuje
    return () => {
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [])

  // Funkcja do wysłania wiadomości do serwera
  const send = (data) => {
    // Wysyłamy tylko jeśli połączenie jest otwarte
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data))
    }
  }

  // Zwracamy stan połączenia, funkcję do wysyłania i obiekt WebSocket
  return { isConnected, send, ws: ws.current }
}
