import express, { type Request, type Response } from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import { parseResume } from "../services/resume.service.js"
import { analyzeAtsWithBert } from "../services/bert.service.js"
import { getErrorMessage } from "../utils/error.js"
import {
  getLatestParserRecord,
  getParserRecordById,
  saveParserRecord,
} from "../services/parser-store.service.js"

const router = express.Router()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.resolve(__dirname, "../../uploads")

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.memoryStorage()
const upload = multer({ storage })

router.post("/upload", upload.single("resume"), async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "Resume file missing" })
    }

    const rawJobDesc = typeof req.body?.jobDesc === "string" ? req.body.jobDesc : ""
    const jobDesc = rawJobDesc.trim()
    const data = await parseResume(req.file.buffer)
    const sourceKey = req.file.originalname || "uploaded-resume"

    const parserRecordId = await saveParserRecord({
      source: "resume",
      sourceKey,
      rawText: data.rawText,
      parsedData: data,
    })

    let atsAnalysis: Awaited<ReturnType<typeof analyzeAtsWithBert>> | null = null
    if (jobDesc.length > 0) {
      atsAnalysis = await analyzeAtsWithBert(jobDesc.slice(0, 12000), data.rawText.slice(0, 12000))
    }

    return res.json({
      ...data,
      parserRecordId,
      jobDescUsed: jobDesc.length > 0,
      atsAnalysis,
    })
  } catch {
    return res.status(500).json({ error: "Resume parsing failed" })
  }
})

router.post("/analyze-text", async (req: Request, res: Response) => {
  try {
    const resumeText = typeof req.body?.resumeText === "string" ? req.body.resumeText.trim() : ""
    const jobDesc = typeof req.body?.jobDesc === "string" ? req.body.jobDesc.trim() : ""

    if (!resumeText || !jobDesc) {
      return res.status(400).json({ error: "resumeText and jobDesc are required" })
    }

    const atsAnalysis = await analyzeAtsWithBert(
      jobDesc.slice(0, 12000),
      resumeText.slice(0, 12000),
    )

    return res.json({ atsAnalysis })
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) })
  }
})

router.get("/latest", async (req: Request, res: Response) => {
  try {
    const sourceKey = String(req.query.sourceKey || "")
    const record = await getLatestParserRecord("resume", sourceKey || undefined)

    if (!record) {
      return res.status(404).json({ error: "No parser record found" })
    }

    return res.json({
      parserRecordId: record.id,
      createdAt: record.created_at,
      data: record.parsed_data,
    })
  } catch {
    return res.status(500).json({ error: "Failed to fetch parser record" })
  }
})

router.get("/record/:id", async (req: Request, res: Response) => {
  try {
    const record = await getParserRecordById(String(req.params.id))
    if (!record || record.source !== "resume") {
      return res.status(404).json({ error: "Parser record not found" })
    }

    return res.json({
      parserRecordId: record.id,
      createdAt: record.created_at,
      data: record.parsed_data,
    })
  } catch {
    return res.status(500).json({ error: "Failed to fetch parser record" })
  }
})

export default router
