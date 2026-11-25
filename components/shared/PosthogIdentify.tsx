"use client"

import { useEffect } from "react"
import posthog from "posthog-js"

interface Props {
  userId: string
  name?: string | null
  role?: string | null
}

export function PosthogIdentify({ userId, name, role }: Props) {
  useEffect(() => {
    posthog.identify(userId, {
      name: name ?? undefined,
      role: role ?? undefined,
    })
  }, [userId, name, role])

  return null
}
