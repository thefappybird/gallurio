'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/app/[locale]/(app)/notifications/_actions'

export interface SerializedNotification {
  _id: string
  type: string
  title: string
  body: string
  href: string
  entityId: string
  entityType: string
  read: boolean
  readAt: string | null
  createdAt: string
}

interface NotificationContextValue {
  notifications: SerializedNotification[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
}

export const NotificationContext = createContext<NotificationContextValue | null>(null)

interface NotificationProviderProps {
  initialNotifications: SerializedNotification[]
  initialUnreadCount: number
  children: React.ReactNode
}

export function NotificationProvider({
  initialNotifications,
  initialUnreadCount,
  children,
}: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<SerializedNotification[]>(initialNotifications)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    let cancelled = false

    async function connect() {
      const res = await fetch('/api/socket-token')
      if (!res.ok || cancelled) return
      const { token } = await res.json()
      if (cancelled) return

      const socket = io({ auth: { token }, transports: ['websocket', 'polling'] })
      socketRef.current = socket

      socket.on('notification:new', (notification: SerializedNotification) => {
        setNotifications((prev) => [notification, ...prev])
        setUnreadCount((n) => n + 1)
      })

      socket.on('notification:read', ({ id }: { id: string }) => {
        setNotifications((prev) =>
          prev.map((n) =>
            n._id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n,
          ),
        )
        setUnreadCount((n) => Math.max(0, n - 1))
      })

      socket.on('notification:readAll', () => {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() })),
        )
        setUnreadCount(0)
      })
    }

    connect()

    return () => {
      cancelled = true
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [])

  function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) =>
        n._id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n,
      ),
    )
    setUnreadCount((n) => Math.max(0, n - 1))
    markNotificationReadAction(id)
  }

  function markAllRead() {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() })),
    )
    setUnreadCount(0)
    markAllNotificationsReadAction()
  }

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  )
}
