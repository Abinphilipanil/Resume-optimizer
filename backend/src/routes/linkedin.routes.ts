import express, { type Request, type Response } from "express"
import { parseLinkedin } from "../services/linkedin.service.js"
import { getErrorMessage } from "../utils/error.js"
import {
  getLatestParserRecord,
  getParserRecordById,
  saveParserRecord,
} from "../services/parser-store.service.js"

const router = express.Router()

function normalizeLinkedinKey(url: string): string {
  return url.trim().toLowerCase()
}

router.post("/parse", async (req: Request, res: Response) => {
  try {
    const { url, useCache } = req.body as { url?: string; useCache?: boolean }

    if (!url) return res.status(400).json({ error: "url is required" })

    if (useCache) {
      const cached = await getLatestParserRecord("linkedin_url", normalizeLinkedinKey(url))
      if (cached) {
        return res.json({
          ...(cached.parsed_data as object),
          source: "cache",
          parserRecordId: cached.id,
        })
      }
    }

    const data = await parseLinkedin(url)
    const parserRecordId = await saveParserRecord({
      source: "linkedin_url",
      sourceKey: normalizeLinkedinKey(url),
      rawText: data.rawText,
      parsedData: data,
    })

    return res.json({ ...data, parserRecordId })
  } catch (err) {
    return res.status(500).json({ error: getErrorMessage(err) })
  }
})

router.get("/latest", async (req: Request, res: Response) => {
  try {
    const url = String(req.query.url || "")
    if (!url) return res.status(400).json({ error: "url query param required" })

    const record = await getLatestParserRecord("linkedin_url", normalizeLinkedinKey(url))
    if (!record) {
      return res.status(404).json({ error: "No parser record found for this LinkedIn URL" })
    }

    return res.json({
      parserRecordId: record.id,
      createdAt: record.created_at,
      data: record.parsed_data,
    })
  } catch (err) {
    return res.status(500).json({ error: getErrorMessage(err) })
  }
})

router.get("/record/:id", async (req: Request, res: Response) => {
  try {
    const record = await getParserRecordById(String(req.params.id))
    if (!record || record.source !== "linkedin_url") {
      return res.status(404).json({ error: "Parser record not found" })
    }

    return res.json({
      parserRecordId: record.id,
      createdAt: record.created_at,
      data: record.parsed_data,
    })
  } catch (err) {
    return res.status(500).json({ error: getErrorMessage(err) })
  }
})

export default router
