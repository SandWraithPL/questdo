// Importy React i bibliotek do zarządzania stanem
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.jsx'

// Konfiguracja React Query - biblioteka do pobierania i cachowania danych z API
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dane są "świeże" przez 30 sekund
      staleTime: 30000,
      // Nie pobieraj danych ponownie gdy okno się znowu aktywuje
      refetchOnWindowFocus: false,
      // Próbuj raz jeśli zapytanie się nie powiedzie
      retry: 1,
    },
  },
})

// Renderujemy główną aplikację do elementu root w HTML
createRoot(document.getElementById('root')).render(
  // StrictMode pomaga znaleźć błędy w kodzie
  <StrictMode>
    {/* Dostarczamy QueryClient do całej aplikacji */}
    <QueryClientProvider client={queryClient}>
      <App />
      {/* Devtools do debugowania zapytań */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
