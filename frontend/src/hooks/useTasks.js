import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const API = "https://questdo-backend-https.azurewebsites.net"

const fetchTasks = async (date) => {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const res = await axios.get(`${API}/tasks/by-date/${date}`, { headers })
  return res.data
}

const fetchAllTasks = async () => {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const res = await axios.get(`${API}/tasks`, { headers })
  return res.data
}

const fetchTasksStats = async () => {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const res = await axios.get(`${API}/tasks/stats`, { headers })
  return res.data
}

const toggleTask = async ({ id, completed }) => {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const res = await axios.patch(`${API}/tasks/${id}`, { completed }, { headers })
  return res.data
}

const createTask = async (taskData) => {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const res = await axios.post(`${API}/tasks`, taskData, { headers })
  return res.data
}

const deleteTask = async (id) => {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const res = await axios.delete(`${API}/tasks/${id}`, { headers })
  return res.data
}

export function useTasks(date) {
  return useQuery({
    queryKey: ['tasks', date],
    queryFn: () => fetchTasks(date),
    staleTime: 30000,
    enabled: !!date,
  })
}

export function useAllTasks() {
  return useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: fetchAllTasks,
    staleTime: 30000,
  })
}

export function useTasksStats() {
  return useQuery({
    queryKey: ['tasks', 'stats'],
    queryFn: fetchTasksStats,
    staleTime: 60000,
  })
}

export function useToggleTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: toggleTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTask,
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
