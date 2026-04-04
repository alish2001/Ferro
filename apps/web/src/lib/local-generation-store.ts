import {
  FerroGenerationSessionIndexItemSchema,
  FerroGenerationSessionSchema,
  type FerroGenerationSession,
  type FerroGenerationSessionIndexItem,
  type FerroLayerMessage,
  type FerroLayerVersion,
} from "@/lib/ferro-contracts"

// Temporary browser-local fallback. Replace this adapter with a real persisted
// session store later without changing the page/component call sites.

const INDEX_KEY = "ferro:generation:index"
const SESSION_KEY_PREFIX = "ferro:generation:"
const MAX_RECENT_SESSIONS = 5
const MAX_VERSIONS_PER_LAYER = 10
const MAX_MESSAGES_PER_LAYER = 20

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function getSessionKey(sessionId: string) {
  return `${SESSION_KEY_PREFIX}${sessionId}`
}

function sortByCreatedAt<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

function takeRecentPerLayer<T extends FerroLayerVersion | FerroLayerMessage>(
  items: T[],
  limit: number,
) {
  const grouped = new Map<string, T[]>()

  for (const item of items) {
    const current = grouped.get(item.layerId) ?? []
    current.push(item)
    grouped.set(item.layerId, current)
  }

  return Array.from(grouped.values()).flatMap((group) =>
    sortByCreatedAt(group).slice(-limit),
  )
}

function buildSessionTitle(session: FerroGenerationSession) {
  const taste = session.request.taste.trim()
  if (taste) return taste.slice(0, 64)

  const instructions = session.request.instructions.trim()
  if (instructions) return instructions.slice(0, 64)

  if (session.request.sourceVideoName) return session.request.sourceVideoName
  return "Untitled generation"
}

function createIndexItem(
  session: FerroGenerationSession,
): FerroGenerationSessionIndexItem {
  return {
    id: session.id,
    status: session.status,
    title: buildSessionTitle(session),
    model: session.request.model,
    layerCount: session.layers.length,
    updatedAt: session.updatedAt,
    sourceVideoName: session.request.sourceVideoName,
  }
}

function readIndex(): FerroGenerationSessionIndexItem[] {
  if (!canUseStorage()) return []

  try {
    const raw = window.localStorage.getItem(INDEX_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    const result = FerroGenerationSessionIndexItemSchema.array().safeParse(parsed)
    return result.success ? result.data : []
  } catch {
    return []
  }
}

function writeIndex(index: FerroGenerationSessionIndexItem[]) {
  if (!canUseStorage()) return
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

function pruneSession(session: FerroGenerationSession): FerroGenerationSession {
  return {
    ...session,
    versions: takeRecentPerLayer(session.versions, MAX_VERSIONS_PER_LAYER),
    messages: takeRecentPerLayer(session.messages, MAX_MESSAGES_PER_LAYER),
  }
}

export function listRecentGenerationSessions() {
  return readIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function loadGenerationSession(sessionId: string) {
  if (!canUseStorage()) return null

  try {
    const raw = window.localStorage.getItem(getSessionKey(sessionId))
    if (!raw) return null

    const parsed = JSON.parse(raw)
    const result = FerroGenerationSessionSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function saveGenerationSession(session: FerroGenerationSession) {
  if (!canUseStorage()) return null

  const nextSession = pruneSession(session)
  window.localStorage.setItem(
    getSessionKey(nextSession.id),
    JSON.stringify(nextSession),
  )

  const nextIndex = [
    createIndexItem(nextSession),
    ...readIndex().filter((item) => item.id !== nextSession.id),
  ]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_RECENT_SESSIONS)

  writeIndex(nextIndex)

  const keepIds = new Set(nextIndex.map((item) => item.id))
  const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
    window.localStorage.key(index),
  ).filter((key): key is string => Boolean(key))

  for (const key of keys) {
    if (key === INDEX_KEY) continue
    if (!key.startsWith(SESSION_KEY_PREFIX)) continue

    const sessionId = key.slice(SESSION_KEY_PREFIX.length)
    if (!keepIds.has(sessionId)) {
      window.localStorage.removeItem(key)
    }
  }

  return nextSession
}

export function markRunningSessionsInterrupted() {
  if (!canUseStorage()) return []

  const interruptedSessions: FerroGenerationSession[] = []

  for (const item of readIndex()) {
    const session = loadGenerationSession(item.id)
    if (!session || session.status !== "running") continue

    const interruptedSession: FerroGenerationSession = {
      ...session,
      status: "interrupted",
      error:
        session.error ?? "The page was reloaded before generation finished.",
      updatedAt: new Date().toISOString(),
      completedAt: session.completedAt,
    }

    const saved = saveGenerationSession(interruptedSession)
    if (saved) interruptedSessions.push(saved)
  }

  return interruptedSessions
}
