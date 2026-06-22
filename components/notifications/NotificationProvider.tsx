'use client'

import { createContext, useEffect, useRef, useState } from 'react'
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
  silent?: boolean
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
    // Use socket.io's async auth callback so a fresh token is fetched on every
    // (re)connection attempt — including reconnects after HMR, server restarts,
    // and 60-second token expiry. A static auth object would reuse the original
    // token on reconnect, silently failing auth and killing the listener.
    const socket = io({
      auth: (cb: (data: { token: string }) => void) => {
        fetch('/api/socket-token')
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('token fetch failed'))))
          .then(({ token }: { token: string }) => cb({ token }))
          .catch((err: unknown) => {
            console.error('[notifications] token fetch error', err)
            cb({ token: '' })
          })
      },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[notifications] connected', socket.id)
    })
    socket.on('disconnect', (reason: string) => {
      console.log('[notifications] disconnected', reason)
    })
    socket.on('connect_error', (err: Error) => {
      console.error('[notifications] connect_error', err.message)
    })

    socket.on('notification:new', (notification: SerializedNotification) => {
      setNotifications((prev) => [notification, ...prev])
      // Silent or pre-read notifications (actor's own actions) must not increment
      // the unread badge or trigger the bell animation.
      if (!notification.silent && !notification.read) {
        setUnreadCount((n) => n + 1)
      }
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

    return () => {
      socket.disconnect()
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
