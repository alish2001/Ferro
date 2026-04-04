import {
  FerroRenderPayloadSchema,
  type FerroRenderPayload,
} from "@/lib/ferro-contracts"

export interface ParsedRenderFormData {
  payload: FerroRenderPayload
  video: File | null
}

export class RenderRequestError extends Error {
  status: number
  body: Record<string, unknown>

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === "string" ? body.error : "Invalid render request")
    this.status = status
    this.body = body
  }
}

export function parseRenderFormData(formData: FormData): ParsedRenderFormData {
  const payloadValue = formData.get("payload")
  const videoValue = formData.get("video")

  if (typeof payloadValue !== "string") {
    throw new RenderRequestError(400, { error: "payload is required" })
  }

  let payloadJson: unknown

  try {
    payloadJson = JSON.parse(payloadValue)
  } catch {
    throw new RenderRequestError(400, { error: "payload must be valid JSON" })
  }

  const parsedPayload = FerroRenderPayloadSchema.safeParse(payloadJson)

  if (!parsedPayload.success) {
    throw new RenderRequestError(400, {
      error: "Invalid render payload",
      issues: parsedPayload.error.flatten(),
    })
  }

  return {
    payload: parsedPayload.data,
    video: videoValue instanceof File ? videoValue : null,
  }
}
