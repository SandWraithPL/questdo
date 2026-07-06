// Importy do zarządzania danymi z API
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

// URL do API backendu
const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

// Funkcja do dodania tokena autoryzacyjnego do requestów
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

// Pobiera zadania dla konkretnego dnia
const fetchTasks = async (date) => {
  const res = await axios.get(`${API}/tasks/by-date/${date}`, { headers: authHeaders() })
  return res.data
}

// Pobiera wszystkie zadania użytkownika
const fetchAllTasks = async () => {
  const res = await axios.get(`${API}/tasks`, { headers: authHeaders() })
  return res.data
}

// Pobiera statystyki zadań użytkownika
const fetchTasksStats = async () => {
  const res = await axios.get(`${API}/tasks/stats`, { headers: authHeaders() })
  return res.data
}

// Zmienia status zadania (ukończone/nieukończone)
const toggleTask = async ({ id, completed }) => {
  const res = await axios.patch(`${API}/tasks/${id}`, { completed }, { headers: authHeaders() })
  return res.data
}

// Tworzy nowe zadanie
const createTask = async (taskData) => {
  const res = await axios.post(`${API}/tasks`, taskData, { headers: authHeaders() })
  return res.data
}

// Usuwa zadanie
const deleteTask = async (id) => {
  const res = await axios.delete(`${API}/tasks/${id}`, { headers: authHeaders() })
  return res.data
}

// Hook do pobierania zadań dla konkretnego dnia
export function useTasks(date) {
  return useQuery({
    queryKey: ['tasks', date],
    queryFn: () => fetchTasks(date),
    staleTime: 30000, // Dane są świeże przez 30 sekund
    enabled: !!date, // Włącz tylko jeśli mamy datę
  })
}

// Hook do pobierania wszystkich zadań
export function useAllTasks() {
  return useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: fetchAllTasks,
    staleTime: 30000,
  })
}

// Hook do pobierania statystyk zadań
export function useTasksStats() {
  return useQuery({
    queryKey: ['tasks', 'stats'],
    queryFn: fetchTasksStats,
    staleTime: 60000, // Statystyki mogą być trochę starsze
  })
}

// Hook do zmiany statusu zadania
export function useToggleTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: toggleTask,
    // Po powodzeniu, przeładuj wszystkie dane zadań
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

// Hook do tworzenia nowego zadania
export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTask,
    // Po powodzeniu, przeładuj dane zadań
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
