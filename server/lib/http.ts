import type { Response } from 'express'

export function sendError(response: Response, status: number, message: string) {
  response.status(status).json({ error: message })
}
