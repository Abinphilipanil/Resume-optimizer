import express, { type Request, type Response } from "express"
import { parseLinkedin } from "../services/linkedin.service.js"
import { parseGithubProfile } from "../services/github.service.js"
import { askLLM } from "../services/llm.service.js"
import { getErrorMessage } from "../utils/error.js"
import { analyzeAtsWithBert } from "../services/bert.service.js"
import { renderResumeLatex, type TemplateChoice } from "../utils/latex.js"
import {
  getLatestParserRecord,
  saveParserRecord,
} from "../services/parser-store.service.js"
import {
  getGeneratedResumeById,
  saveGeneratedResumeRecord,
} from "../services/generated-resume-store.service.js"

const router = express.Router()

function extractGithubUsername(url: string): string {
  try {
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`)
    const pathParts = urlObj.pathname.split("/").filter((part) => part.length > 0)
    return pathParts[0] || url
  } catch {
    return url
  }
}

function normalizeLinkedinKey(url?: string): string | undefined {
  if (!url) return undefined
  return url.trim().toLowerCase()
}

function stringifyLinkedinSkills(skills: unknown): string {
  if (Array.isArray(skills) && skills.length) {
    return skills.join(", ")
  }

  if (skills && typeof skills === "object") {
    const values = Object.values(skills as Record<string, unknown>).flat()
    const normalized = values.map((item) => String(item)).filter(Boolean)
    return normalized.length ? normalized.join(", ") : "N/A"
  }

  return "N/A"
}

function extractAcademicSignals(text?: string | null): string[] {
  if (!text) return []

  const source = text.replace(/\s+/g, " ").trim()
  const signals = new Set<string>()

  const metricPatterns = [
    /\b(?:cgpa|gpa)\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?(?:\s*\/\s*(?:10|4))?)\b/gi,
    /\b(?:percentage|percent|marks)\s*[:\-]?\s*([0-9]{2}(?:\.[0-9]+)?\s*%)/gi,
  ]

  for (const pattern of metricPatterns) {
    let match: RegExpExecArray | null = null
    while ((match = pattern.exec(source)) !== null) {
      const value = match[1]?.trim()
      if (value) signals.add(value)
    }
  }

  const contextPattern =
    /\b(?:b\.?\s?tech|bachelor|master|m\.?\s?tech|degree|university|college|class\s*xii|class\s*x|12th|10th)\b[^.]{0,120}\b(?:cgpa|gpa|percentage|percent|marks)\b[^.]{0,80}/gi
  let contextMatch: RegExpExecArray | null = null
  while ((contextMatch = contextPattern.exec(source)) !== null) {
    const context = contextMatch[0]?.trim()
    if (context) signals.add(context)
  }

  return [...signals].slice(0, 8)
}

function getSpecificTemplateDirective(templateChoice?: TemplateChoice | null): string {
  const templateName = String(templateChoice?.name || "").toLowerCase()
  const templateId = Number(templateChoice?.id || 0)

  if (templateId === 1 || templateName.includes("angela minimalist")) {
    return "Apply the Angela Minimalist pattern: short one-line bullets, compact spacing, and strictly functional wording."
  }

  if (templateId === 2 || templateName.includes("bryan simple")) {
    return "Apply the Bryan Simple pattern: straightforward section labels, crisp sentence structure, and no extra narrative."
  }

  if (templateId === 3 || templateName.includes("david compact")) {
    return "Apply the David Compact pattern: dense, high-signal bullets with no filler and maximum content efficiency."
  }

  if (templateId === 4 || templateName.includes("david elegant")) {
    return "Apply the David Elegant pattern: premium executive tone, refined phrasing, and impact-first wording."
  }

  if (templateId === 5 || templateName.includes("david modern")) {
    return "Apply the David Modern pattern: modern business tone with strong action verbs and concise achievement framing."
  }

  if (templateId === 6 || templateName.includes("david professional")) {
    return "Apply the David Professional pattern: classic ATS-safe structure with balanced detail and polished formality."
  }

  if (templateId === 7 || templateName.includes("margaret colorful")) {
    return "Apply the Margaret Colorful pattern: energetic but professional phrasing, readable flow, and clear achievement highlights."
  }

  if (templateId === 8 || templateName.includes("margaret creative")) {
    return "Apply the Margaret Creative pattern: narrative-forward yet ATS-safe writing with strong project storytelling."
  }

  return ""
}

function getTemplateStyleDirective(format?: string, templateChoice?: TemplateChoice | null): string {
  const normalized = (templateChoice?.category || format || "Professional").toLowerCase()
  const templateName = templateChoice?.name ? `Template selected: ${templateChoice.name}.` : ""
  const templateSpecificDirective = getSpecificTemplateDirective(templateChoice)
  const prefix = [templateName, templateSpecificDirective].filter(Boolean).join("\n")

  if (normalized.includes("minimal")) {
    return `${prefix ? `${prefix}\n` : ""}
Use a minimalist style: concise bullets, tight wording, clear hierarchy, no decorative language.
Keep sections compact and prioritize readability with short impact statements.`
  }

  if (normalized.includes("executive")) {
    return `${prefix ? `${prefix}\n` : ""}
Use an executive style: leadership-oriented summary, business impact metrics, strategic outcomes, and senior tone.
Prioritize achievements that show ownership, scale, and decision-making impact.`
  }

  if (normalized.includes("creative")) {
    return `${prefix ? `${prefix}\n` : ""}
Use a modern creative-professional style: strong narrative, energetic but professional tone, and project storytelling.
Keep ATS-safe wording and avoid gimmicky symbols.`
  }

  if (normalized.includes("academic")) {
    return `${prefix ? `${prefix}\n` : ""}
Use an academic-professional style: detailed but structured content, strong technical depth, coursework/research relevance when available.
Maintain concise wording and ATS compatibility.`
  }

  return `${prefix ? `${prefix}\n` : ""}
Use a professional style: balanced detail, clean section flow, measurable impact, and ATS-friendly language.
Ensure polished grammar and formal tone.`
}

function normalizeResumeHeader(markdown: string): string {
  const lines = markdown.split(/\r?\n/)

  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift()
  }

  if (!lines.length) return markdown.trim()

  const firstLine = lines[0].trim()
  if (/^#\s+/.test(firstLine)) {
    lines[0] = firstLine.replace(/^#+\s+/, "# ")
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
  }

  let nameCandidate = firstLine
  let contactLine = ""

  const emailMatch = firstLine.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  if (emailMatch && typeof emailMatch.index === "number") {
    const beforeEmail = firstLine.slice(0, emailMatch.index).trim()
    if (beforeEmail) {
      nameCandidate = beforeEmail.replace(/[|,\-–—]+$/g, "").trim()
    }

    const afterName = firstLine.replace(nameCandidate, "").trim()
    contactLine = afterName.replace(/^[|,\-–—\s]+/, "").trim()
  } else if (firstLine.includes("|")) {
    const parts = firstLine
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean)

    if (parts.length >= 2) {
      nameCandidate = parts[0]
      contactLine = parts.slice(1).join(" | ")
    }
  } else if (/^[A-Za-z][A-Za-z .'-]{2,70}$/.test(firstLine) && lines[1]) {
    const nextLine = lines[1].trim()
    if (/@|linkedin\.com|github\.com|\+?\d[\d\s()-]{7,}/i.test(nextLine)) {
      contactLine = nextLine
      lines.splice(1, 1)
    }
  }

  if (!/^[A-Za-z][A-Za-z .'-]{1,80}$/.test(nameCandidate)) {
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
  }

  lines[0] = `# ${nameCandidate}`
  if (contactLine) {
    lines.splice(1, 0, contactLine)
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

function sanitizeGeneratedResume(markdown: string): string {
  const cleaned = markdown
    .replace(/<center>/gi, "")
    .replace(/<\/center>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<div>/gi, "")
    .replace(/<\/div>/gi, "")
    .replace(/^\s{0,3}(#{1,6}\s*)?header\s*$/gim, "")
    .replace(/^\s{0,3}(#{1,6}\s*)?contact\s+information\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return normalizeResumeHeader(cleaned)
}

function buildLinkedinSection(linkedinData: Record<string, any> | null, linkedinUrl?: string): string {
  if (!linkedinData) {
    return "## LinkedIn / Profile Data\nNo LinkedIn data available. Build resume from GitHub data only."
  }

  const experience = Array.isArray(linkedinData.experience) ? linkedinData.experience : []
  const education = Array.isArray(linkedinData.education) ? linkedinData.education : []

  return `## LinkedIn / Profile Data (USE FOR CONTACT INFO)
- Full Name: ${linkedinData.name || "N/A"}
- Headline: ${linkedinData.headline || "N/A"}
- Contact Email: ${linkedinData.email || "N/A"}
- Contact Phone: ${linkedinData.phone || "N/A"}
- Location: ${linkedinData.location || "N/A"}
- Portfolio/Website: ${linkedinData.website || linkedinData.blog || "N/A"}
- LinkedIn URL: ${linkedinData.linkedin_url || linkedinUrl || "N/A"}
- Summary: ${linkedinData.summary || linkedinData.about || "N/A"}
- Skills: ${stringifyLinkedinSkills(linkedinData.skills)}

### Work Experience
${experience.length
    ? experience
      .map(
        (entry: Record<string, any>) =>
          `- ${entry.title || "Role"} at ${entry.company || "Company"} (${entry.duration || "Dates N/A"})\n  ${entry.description || ""}`,
      )
      .join("\n")
    : "No work experience data available."}

### Education (extract CGPA/GRADE when present)
${education.length
    ? education
      .map(
        (entry: Record<string, any>) =>
          `- ${entry.degree || "Degree"} - ${entry.institution || "Institution"} (${entry.years || "N/A"}) | Academic Performance: ${entry.grade || "N/A"} | Coursework: ${entry.coursework || "N/A"} | Honors/Awards: ${entry.honors || "N/A"}`,
      )
      .join("\n")
    : "No education data available."}`
}

function buildGithubSection(githubData: Awaited<ReturnType<typeof parseGithubProfile>> | null): string {
  if (!githubData) {
    return "## GitHub Profile\nGitHub data could not be fetched."
  }

  return `## GitHub Profile (@${githubData.profile.login})
- Full name: ${githubData.profile.name || "N/A"}
- Bio: ${githubData.profile.bio || "N/A"}
- Location: ${githubData.profile.location || "N/A"}
- Company: ${githubData.profile.company || "N/A"}
- Blog/Portfolio: ${githubData.profile.blog || "N/A"}
- Public Repos: ${githubData.profile.publicRepos}
- Top Languages: ${githubData.topLanguages.join(", ")}

### Top Projects
${githubData.topRepositories
    .map(
      (repo, index) =>
        `${index + 1}. ${repo.name} - ${repo.description || "No description"} | Tech: ${repo.language || "N/A"} | Topics: ${repo.topics.join(", ") || "none"}`,
    )
    .join("\n")}`
}

router.post("/build-from-links", async (req: Request, res: Response) => {
  const {
    linkedin: linkedinUrl,
    github: githubUrl,
    jobDesc,
    linkedinPdfData,
    previousResumeText,
    format,
    templateChoice,
  } = req.body as {
    linkedin?: string
    github?: string
    jobDesc?: string
    linkedinPdfData?: Record<string, unknown>
    previousResumeText?: string
    format?: string
    templateChoice?: TemplateChoice | null
  }

  if (!githubUrl || !jobDesc) {
    return res.status(400).json({ error: "github and jobDesc are required" })
  }

  console.log(`Building resume for GitHub=${githubUrl}`)

  let linkedinData: Record<string, any> | null = null
  let linkedinFetchedViaPdf = false
  let linkedinParserRecordId: string | null = null

  if (linkedinPdfData && typeof linkedinPdfData === "object" && Object.keys(linkedinPdfData).length > 0) {
    linkedinData = linkedinPdfData as Record<string, any>
    linkedinFetchedViaPdf = true
  } else if (linkedinUrl) {
    const linkedinKey = normalizeLinkedinKey(linkedinUrl)
    const cachedLinkedin = await getLatestParserRecord("linkedin_url", linkedinKey)

    if (cachedLinkedin?.parsed_data && typeof cachedLinkedin.parsed_data === "object") {
      linkedinData = cachedLinkedin.parsed_data as Record<string, any>
      linkedinParserRecordId = cachedLinkedin.id
      console.log("Loaded LinkedIn data from parser cache")
    } else {
      const scraped = await parseLinkedin(linkedinUrl)
      if (scraped.fetchedViaProfile) {
        linkedinData = scraped as unknown as Record<string, any>
      }

      linkedinParserRecordId = await saveParserRecord({
        source: "linkedin_url",
        sourceKey: linkedinKey,
        rawText: scraped.rawText,
        parsedData: scraped,
      })
    }
  }

  let githubData: Awaited<ReturnType<typeof parseGithubProfile>> | null = null
  let githubParserRecordId: string | null = null

  const githubUsername = extractGithubUsername(githubUrl)
  const cachedGithub = await getLatestParserRecord("github", githubUsername)

  if (cachedGithub?.parsed_data && typeof cachedGithub.parsed_data === "object") {
    githubData = cachedGithub.parsed_data as Awaited<ReturnType<typeof parseGithubProfile>>
    githubParserRecordId = cachedGithub.id
    console.log(`Loaded GitHub data from parser cache for @${githubUsername}`)
  } else {
    try {
      githubData = await parseGithubProfile(githubUsername)
      githubParserRecordId = await saveParserRecord({
        source: "github",
        sourceKey: githubUsername,
        rawText: JSON.stringify(githubData).slice(0, 30000),
        parsedData: githubData,
      })
    } catch (error) {
      console.error(`GitHub parse failed: ${getErrorMessage(error)}`)
    }
  }

  const linkedinSection = buildLinkedinSection(linkedinData, linkedinUrl)
  const githubSection = buildGithubSection(githubData)

  const previousResumeSection = previousResumeText
    ? `\n## Previous Resume (additional context)\n${previousResumeText.slice(0, 3000)}`
    : ""
  const academicSignals = extractAcademicSignals(
    `${previousResumeText || ""}\n${linkedinData?.rawText || ""}\n${linkedinData?.summary || ""}`,
  )
  const academicSignalsSection = academicSignals.length
    ? `\n## Academic Signals (from parsed docs)\n${academicSignals.map((item) => `- ${item}`).join("\n")}`
    : ""

  const formatDirective = getTemplateStyleDirective(format, templateChoice)

  const systemPrompt = `You are a senior technical career consultant.
Create a high-quality ATS-oriented resume from only the provided facts.

Rules:
- Output pure Markdown only.
- Do not invent projects, companies, or achievements.
- Keep a clear 1-2 page structure.
- Header is mandatory and strict:
  1) First line must be exactly a Markdown H1 with full name only (example: "# Jane Doe").
  2) Second line must be contact info only: email | phone | LinkedIn | GitHub | portfolio.
  3) Never place email or links on the H1 line.
  4) Do not use "HEADER" label.
- Use sections in this order after the contact block: Summary, Experience, Projects, Skills, Education, Certificates (if present).
- Education section is mandatory when any academic data exists.
- For every education entry include: degree, institution, years, and CGPA/GPA/Percentage (if available in any source).
- Include relevant academic details when available: coursework, honors, scholarships, notable projects/thesis.
- Make the resume feel production-ready and professionally polished.
- Each experience/project bullet should emphasize impact, responsibility, and technical depth.
- ${formatDirective}`

  const userMessage = `## Real Profile Data
${linkedinSection}

${githubSection}
${previousResumeSection}
${academicSignalsSection}

## Target Job Description
\`\`\`
${jobDesc}
\`\`\`

Write the final resume using only real data above. If a section has no data, skip it.`

  let generatedResume: string
  try {
    const rawResume = await askLLM({
      message: userMessage,
      systemHint: systemPrompt,
      temperature: 0.2,
    })

    generatedResume = sanitizeGeneratedResume(rawResume)
  } catch (error) {
    return res.status(500).json({ error: `Resume generation failed: ${getErrorMessage(error)}` })
  }

  const generatedResumeLatex = renderResumeLatex(generatedResume, templateChoice)
  const atsAnalysis = await analyzeAtsWithBert(jobDesc, generatedResume)

  const dbId = await saveGeneratedResumeRecord({
    linkedin_url: linkedinUrl || null,
    github_url: githubUrl,
    job_description: jobDesc,
    linkedin_data: linkedinData || {},
    github_data: (githubData as unknown as Record<string, unknown>) || {},
    generated_resume_markdown: generatedResume,
    ats_score: atsAnalysis?.score || 0,
    ats_analysis: atsAnalysis || {},
  })

  return res.json({
    message: "Resume generated successfully",
    resume: generatedResume,
    resumeLatex: generatedResumeLatex,
    dbId,
    linkedinFetched: Boolean(linkedinData) || linkedinFetchedViaPdf,
    githubFetched: Boolean(githubData),
    linkedinParserRecordId,
    githubParserRecordId,
    atsAnalysis,
  })
})

router.get("/resume/:id", async (req: Request, res: Response) => {
  try {
    const record = await getGeneratedResumeById(String(req.params.id))

    if (!record) {
      return res.status(404).json({ error: "Resume not found" })
    }

    return res.json(record)
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) })
  }
})

export default router
