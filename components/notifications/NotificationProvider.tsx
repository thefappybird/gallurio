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
  /** Template vars for render-time translation. Absent on legacy rows — fall back to title/body. */
  params?: Record<string, string | undefined>
}

interface NotificationContextValue {
  notifications: SerializedNotification[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
  /**
   * Increments once per live `notification:new` socket arrival (non-silent,
   * unread only) — never on the initial unread-count fetch. Consumers watch
   * this to distinguish "a notification just arrived in real time" from the
   * unrelated unreadCount changes caused by mount-time hydration or markRead.
   */
  liveArrivalTick: number
  /**
   * Bumps on every `notification:new` socket arrival, unconditionally (even
   * silent/pre-read ones from the actor's own action in another tab), so
   * list surfaces can soft-refresh when their entity type changes live.
   */
  lastEntityEvent: { entityType: string; entityId: string; tick: number } | null
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
  const [liveArrivalTick, setLiveArrivalTick] = useState(0)
  const [lastEntityEvent, setLastEntityEvent] = useState<NotificationContextValue['lastEntityEvent']>(null)
  const entityEventTick = useRef(0)
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
          .catch(() => {
            // Realtime is an enhancement: notifications remain persisted and
            // available on the next render even if the tunnel is unavailable.
            cb({ token: '' })
          })
      },
      // Start with the normal HTTP polling handshake so reverse proxies and
      // tunnels can establish the session, then upgrade to WebSocket when it
      // is available. Starting WebSocket-first leaves Socket.IO unable to
      // fall back on some tunnel configurations.
      transports: ['polling', 'websocket'],
      tryAllTransports: true,
      timeout: 5_000,
      // Notifications persist to Mongo, so a temporary socket outage should
      // not cause an endless background reconnect loop or console spam.
      reconnectionAttempts: 3,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[notifications] connected', socket.id)
    })
    socket.on('disconnect', (reason: string) => {
      console.log('[notifications] disconnected', reason)
    })
    // Do not surface a transport outage as an application error. Socket.IO
    // performs the bounded reconnect attempts above; persisted notifications
    // remain the fallback if it cannot reconnect.
    socket.on('connect_error', () => undefined)

    socket.on('notification:new', (notification: SerializedNotification) => {
      setNotifications((prev) => [notification, ...prev])
      // Silent or pre-read notifications (actor's own actions) must not increment
      // the unread badge or trigger the bell animation.
      if (!notification.silent && !notification.read) {
        setUnreadCount((n) => n + 1)
        setLiveArrivalTick((t) => t + 1)
      }
      entityEventTick.current += 1
      setLastEntityEvent({
        entityType: notification.entityType,
        entityId: notification.entityId,
        tick: entityEventTick.current,
      })
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
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markRead, markAllRead, liveArrivalTick, lastEntityEvent }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
