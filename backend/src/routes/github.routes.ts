import express, { type Request, type Response } from "express"
import { parseGithubProfile } from "../services/github.service.js"
import {
  getLatestParserRecord,
  getParserRecordById,
  saveParserRecord,
} from "../services/parser-store.service.js"

const router = express.Router()

function asBoolean(value: unknown): boolean {
  return String(value || "").toLowerCase() === "true"
}

async function respondFromCacheIfAvailable(
  res: Response,
  username: string,
  useCache: boolean,
): Promise<boolean> {
  if (!useCache) return false

  const cached = await getLatestParserRecord("github", username)
  if (!cached) return false

  const cachedData =
    cached.parsed_data && typeof cached.parsed_data === "object"
      ? (cached.parsed_data as Record<string, unknown>)
      : { value: cached.parsed_data }

  res.json({
    ...cachedData,
    source: "cache",
    parserRecordId: cached.id,
  })

  return true
}

router.post("/parse", async (req: Request, res: Response) => {
  try {
    const { username, useCache } = req.body as { username?: string; useCache?: boolean }
    if (!username) return res.status(400).json({ error: "username is required" })

    const servedFromCache = await respondFromCacheIfAvailable(res, username, Boolean(useCache))
    if (servedFromCache) return

    const data = await parseGithubProfile(username)
    const parserRecordId = await saveParserRecord({
      source: "github",
      sourceKey: username,
      parsedData: data,
      rawText: JSON.stringify(data).slice(0, 30000),
    })

    return res.json({ ...data, parserRecordId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
})

router.get("/parse", async (req: Request, res: Response) => {
  try {
    const username = String(req.query.username || "")
    const useCache = asBoolean(req.query.useCache)

    if (!username) return res.status(400).json({ error: "username query param required" })

    const servedFromCache = await respondFromCacheIfAvailable(res, username, useCache)
    if (servedFromCache) return

    const data = await parseGithubProfile(username)
    const parserRecordId = await saveParserRecord({
      source: "github",
      sourceKey: username,
      parsedData: data,
      rawText: JSON.stringify(data).slice(0, 30000),
    })

    return res.json({ ...data, parserRecordId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
})

router.get("/latest", async (req: Request, res: Response) => {
  try {
    const username = String(req.query.username || "")
    if (!username) return res.status(400).json({ error: "username query param required" })

    const cached = await getLatestParserRecord("github", username)
    if (!cached) {
      return res.status(404).json({ error: "No parser record found for this username" })
    }

    return res.json({
      parserRecordId: cached.id,
      createdAt: cached.created_at,
      data: cached.parsed_data,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
})

router.get("/record/:id", async (req: Request, res: Response) => {
  try {
    const record = await getParserRecordById(String(req.params.id))
    if (!record || record.source !== "github") {
      return res.status(404).json({ error: "Parser record not found" })
    }

    return res.json({
      parserRecordId: record.id,
      createdAt: record.created_at,
      data: record.parsed_data,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
})

export default router
