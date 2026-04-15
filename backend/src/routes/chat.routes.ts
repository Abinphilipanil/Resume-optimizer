import express from "express"
import { askLLM } from "../services/llm.service.js"
import { getGeneratedResumeById } from "../services/generated-resume-store.service.js"

const router = express.Router()

const CAREER_SYSTEM_PROMPT = `You are Resume AI, an expert career advisor and resume specialist built into a professional resume builder platform.
You help users with:
- Resume writing, optimization, and ATS improvements
- Interview preparation and job application strategies
- Career guidance, skill gap analysis, and growth planning
- LinkedIn profile improvement tips
- Salary negotiation advice

Rules:
- Be concise, practical, and actionable.
- Use bullet points for lists.
- Always respond in a warm, encouraging, and professional tone.
- If asked something unrelated to careers or resumes, politely redirect to career topics.
- Never make up job listings or specific company information.
- If user context is available, tailor advice specifically to that profile.
- When ATS data is available, prioritize detailed, high-impact improvement actions first.
- Prefer concrete rewrites/examples over generic tips.`

function toCompactJson(value: unknown, maxLen: number = 3500): string {
  try {
    return JSON.stringify(value).slice(0, maxLen)
  } catch {
    return ""
  }
}

function trimText(value: unknown, maxLen: number = 5000): string {
  return String(value || "").slice(0, maxLen).trim()
}

router.post("/", async (req, res) => {
  try {
    const { message, resumeContext, resumeDbId, atsContext, jobDescription } = req.body

    if (!message) {
      return res.status(400).json({ error: "Message required" })
    }

    let dbContextBlock = ""
    if (typeof resumeDbId === "string" && resumeDbId.trim()) {
      const dbRecord = await getGeneratedResumeById(resumeDbId.trim())
      if (dbRecord) {
        dbContextBlock = `[Stored User Data]
Job Description:
${trimText(dbRecord.job_description, 2800)}

Generated Resume:
${trimText(dbRecord.generated_resume_markdown, 3500)}

ATS Analysis:
${toCompactJson(dbRecord.ats_analysis, 2500)}`
      }
    }

    const rawResumeContext = trimText(resumeContext, 3500)
    const rawAtsContext = trimText(atsContext, 2500)
    const rawJobDescription = trimText(jobDescription, 2800)

    const pieces = [
      dbContextBlock ? dbContextBlock : "",
      rawResumeContext ? `[Client Resume Context]\n${rawResumeContext}` : "",
      rawAtsContext ? `[Client ATS Context]\n${rawAtsContext}` : "",
      rawJobDescription ? `[Client Job Description]\n${rawJobDescription}` : "",
      `[User Question]\n${message}`,
    ].filter(Boolean)

    const contextualMessage = pieces.join("\n\n")

    const reply = await askLLM({
      message: contextualMessage,
      systemHint: CAREER_SYSTEM_PROMPT,
      temperature: 0.2,
    })

    return res.json({ reply })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Chat failed"
    console.error("Chat error:", msg)
    return res.status(500).json({ error: msg })
  }
})

export default router
