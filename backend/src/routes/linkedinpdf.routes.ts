import express, { type Request, type Response } from "express"
import multer from "multer"
import { createRequire } from "module"
const require = createRequire(import.meta.url)
const { PDFParse } = require("pdf-parse")
import { askLLM } from "../services/llm.service.js"
import {
  getLatestParserRecord,
  getParserRecordById,
  saveParserRecord,
} from "../services/parser-store.service.js"
import { supabase } from "../config/supabase.js"

const router = express.Router()

const storage = multer.memoryStorage()
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

router.post("/parse-pdf", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "LinkedIn PDF file is required" })
    }

    console.log(`Parsing LinkedIn PDF: ${req.file.originalname}`)


    // Extract raw text from PDF using PDFParse class (v2.x)
    const parser = new PDFParse({ data: req.file.buffer })
    const textResult = await parser.getText()
    const rawText = textResult.text
    await parser.destroy()

    if (!rawText || rawText.trim().length < 50) {
      return res.status(400).json({ error: "PDF appears to be empty or unreadable. Please export a text-based LinkedIn PDF." })
    }

    console.log(`📝 PDF text extracted (${rawText.length} chars), sending to Gemini...`)

    // Use Gemini to extract structured data from the raw PDF text
    const extractionPrompt = `[EXPERT NLP EXTRACTION]
Analyze this LinkedIn PDF export text and return only valid JSON.

JSON schema:
{
  "name": "Full Name",
  "headline": "Professional Title",
  "email": "address or null",
  "phone": "number or null",
  "location": "City, Country or null",
  "website": "Portfolio URL or null",
  "linkedin_url": "LinkedIn URL or null",
  "summary": "Impactful summary",
  "skills": { "technical": [], "soft": [], "tools": [] },
  "experience": [
    { "title": "Role", "company": "Org", "duration": "Dates", "description": "Quantifiable description" }
  ],
  "education": [
    { "degree": "Degree", "institution": "University", "years": "Dates", "grade": "GPA/CGPA/Percentage" }
  ],
  "projects": ["Impactful project descriptions"]
}

INPUT:
---
${rawText.slice(0, 12000)}
---`

    const llmResponse = await askLLM({ message: extractionPrompt, temperature: 0.1 })

    // Parse the JSON response
    let parsedData: Record<string, any> = {}
    try {
      // Strip any markdown fences if Gemini added them
      const cleaned = llmResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      parsedData = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error("LLM JSON parse failed:", parseErr)
      // Return raw text at minimum
      parsedData = { name: "", headline: "", rawText: rawText.slice(0, 3000) }
    }

    // Store in Supabase
    if (!supabase) {
      return res.status(500).json({ error: "Supabase client not initialized" })
    }
    try {
      await supabase.from("linkedin_profiles").insert([
        {
          raw_text: rawText.slice(0, 10000),
          parsed_data: parsedData,
          created_at: new Date().toISOString(),
        },
      ])
    } catch (dbErr) {
      console.warn("Supabase store warning (non-fatal):", dbErr)
    }

    console.log(`✅ LinkedIn PDF parsed: name="${parsedData.name}"`)

    return res.json({
      success: true,
      data: parsedData,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
})

export default router
