import { askLLM } from "./llm.service.js"
import { getErrorMessage } from "../utils/error.js"

export type BertAtsAnalysis = {
  score: number
  matchLevel: "Excellent" | "Good" | "Fair" | "Poor"
  skillsPresent: string[]
  skillsMissing: string[]
  missingKeywords: string[]
  conceptualGaps: string[]
  strengths: string[]
  weaknesses: string[]
  gameChangerTips: string[]
  bertMetadata: {
    model: string
    analysisType: string
    usedFallback: boolean
  }
}

type FeatureExtractionOutput = {
  data?: Float32Array | number[]
}

type FeatureExtractor = (
  text: string,
  options?: {
    pooling?: "mean"
    normalize?: boolean
  },
) => Promise<FeatureExtractionOutput | number[] | number[][]>

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "in", "is", "it", "of", "on", "or", "that", "the", "to", "with", "will", "you", "your", "our", "we", "this", "those", "their", "they", "into", "over", "under", "using", "use", "used", "build", "built", "experience", "years", "year", "ability", "strong", "knowledge", "work", "working", "candidate", "role", "job", "skills", "skill",
])

let extractorPromise: Promise<FeatureExtractor> | null = null
let resolvedBertModel = process.env.BERT_MODEL || "Xenova/all-MiniLM-L6-v2"

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getMatchLevel(score: number): "Excellent" | "Good" | "Fair" | "Poor" {
  if (score >= 85) return "Excellent"
  if (score >= 70) return "Good"
  if (score >= 50) return "Fair"
  return "Poor"
}

function splitSentences(text: string, maxItems: number): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 30)
    .sort((a, b) => b.length - a.length)
    .slice(0, maxItems)
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .match(/[a-z][a-z0-9+.#-]{1,}/g) ?? []
}

function extractImportantTerms(text: string, maxTerms: number): string[] {
  const counts = new Map<string, number>()
  for (const token of tokenize(text)) {
    if (STOP_WORDS.has(token)) continue
    counts.set(token, (counts.get(token) || 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTerms)
    .map(([term]) => term)
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (!normA || !normB) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function parseEmbedding(output: FeatureExtractionOutput | number[] | number[][]): number[] {
  if (Array.isArray(output)) {
    if (output.length === 0) return []

    if (typeof output[0] === "number") {
      return output as number[]
    }

    if (Array.isArray(output[0])) {
      return (output[0] as number[]).map((v) => Number(v))
    }
  }

  const data = (output as FeatureExtractionOutput).data
  if (!data) return []
  return Array.from(data)
}

async function getFeatureExtractor(): Promise<FeatureExtractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const transformers = await import("@xenova/transformers") as {
        pipeline: (task: string, model: string) => Promise<FeatureExtractor>
        env?: {
          allowRemoteModels?: boolean
          allowLocalModels?: boolean
        }
      }

      if (transformers.env) {
        transformers.env.allowRemoteModels = true
        transformers.env.allowLocalModels = false
      }

      resolvedBertModel = process.env.BERT_MODEL || "Xenova/all-MiniLM-L6-v2"
      return await transformers.pipeline("feature-extraction", resolvedBertModel)
    })()
  }

  return extractorPromise
}

async function embedText(text: string): Promise<number[]> {
  const extractor = await getFeatureExtractor()
  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  })

  const vector = parseEmbedding(output)
  if (!vector.length) {
    throw new Error("BERT extractor returned an empty embedding")
  }

  return vector
}

function getQuantificationScore(resumeText: string): number {
  const numberHits = (resumeText.match(/\b\d+(\.\d+)?%?\b/g) || []).length
  const metricWords = (resumeText.match(/\b(increased|reduced|improved|saved|optimized|delivered|grew|launched|scaled)\b/gi) || []).length

  const numberScore = clamp(numberHits / 20, 0, 1)
  const impactScore = clamp(metricWords / 12, 0, 1)

  return clamp(numberScore * 0.6 + impactScore * 0.4, 0, 1)
}

function buildDeterministicTips(missing: string[], keywordCoverage: number, quantificationScore: number): { weaknesses: string[]; tips: string[]; conceptualGaps: string[] } {
  const weaknesses: string[] = []
  const tips: string[] = []
  const conceptualGaps: string[] = []

  if (missing.length) {
    weaknesses.push("Several high-priority job requirements are missing or weakly represented.")
    tips.push(`Add resume evidence for these requirements first: ${missing.slice(0, 5).join(", ")}.`)
    conceptualGaps.push(`Missing technical alignment around: ${missing.slice(0, 4).join(", ")}.`)
  }

  if (keywordCoverage < 0.55) {
    weaknesses.push("Keyword alignment is below ATS-safe range for this job description.")
    tips.push("Mirror exact role language in project and experience bullets where truthful.")
  }

  if (quantificationScore < 0.4) {
    weaknesses.push("Impact metrics are limited, reducing score confidence.")
    tips.push("Add measurable outcomes (%, scale, latency, revenue, users, cost) to each major bullet.")
  }

  if (!weaknesses.length) {
    weaknesses.push("No critical structural weaknesses were detected.")
    tips.push("Tune section ordering and top 3 bullets to match the role's top priorities.")
  }

  if (!conceptualGaps.length) {
    conceptualGaps.push("No major conceptual gaps detected in sampled semantic space.")
  }

  return { weaknesses, tips, conceptualGaps }
}

async function runBertAnalysis(jobDescription: string, resumeText: string): Promise<BertAtsAnalysis> {
  const normalizedJob = normalizeText(jobDescription)
  const normalizedResume = normalizeText(resumeText)

  const [jobVector, resumeVector] = await Promise.all([
    embedText(normalizedJob.slice(0, 6000)),
    embedText(normalizedResume.slice(0, 6000)),
  ])

  const jdSentences = splitSentences(normalizedJob, 12)
  const resumeSentences = splitSentences(normalizedResume, 20)

  let sentenceCoverage = 0
  if (jdSentences.length && resumeSentences.length) {
    const jdEmbeddings = await Promise.all(jdSentences.map((sentence) => embedText(sentence)))
    const resumeEmbeddings = await Promise.all(resumeSentences.map((sentence) => embedText(sentence)))

    const sentenceScores = jdEmbeddings.map((jdEmbedding) => {
      let best = 0
      for (const resumeEmbedding of resumeEmbeddings) {
        const similarity = cosineSimilarity(jdEmbedding, resumeEmbedding)
        if (similarity > best) best = similarity
      }
      return clamp(best, 0, 1)
    })

    sentenceCoverage = sentenceScores.reduce((sum, score) => sum + score, 0) / sentenceScores.length
  }

  const semanticSimilarity = clamp(cosineSimilarity(jobVector, resumeVector), 0, 1)

  const jdTerms = extractImportantTerms(normalizedJob, 30)
  const resumeTerms = new Set(extractImportantTerms(normalizedResume, 60))
  const matchedTerms = jdTerms.filter((term) => resumeTerms.has(term))
  const missingTerms = jdTerms.filter((term) => !resumeTerms.has(term)).slice(0, 12)

  const keywordCoverage = jdTerms.length ? matchedTerms.length / jdTerms.length : 0
  const quantificationScore = getQuantificationScore(normalizedResume)

  const weighted =
    semanticSimilarity * 0.4 +
    sentenceCoverage * 0.3 +
    keywordCoverage * 0.2 +
    quantificationScore * 0.1

  const score = Math.round(clamp(weighted, 0, 1) * 100)
  const matchLevel = getMatchLevel(score)

  const strengths = [
    `Global semantic similarity is ${(semanticSimilarity * 100).toFixed(1)}%.`,
    `Context sentence coverage across job requirements is ${(sentenceCoverage * 100).toFixed(1)}%.`,
  ]

  if (matchedTerms.length) {
    strengths.push(`Strong term overlap includes: ${matchedTerms.slice(0, 6).join(", ")}.`)
  }

  const guidance = buildDeterministicTips(missingTerms, keywordCoverage, quantificationScore)

  return {
    score,
    matchLevel,
    skillsPresent: matchedTerms.slice(0, 12),
    skillsMissing: missingTerms.slice(0, 12),
    missingKeywords: missingTerms,
    conceptualGaps: guidance.conceptualGaps,
    strengths,
    weaknesses: guidance.weaknesses,
    gameChangerTips: guidance.tips,
    bertMetadata: {
      model: resolvedBertModel,
      analysisType: "Bidirectional embedding similarity + sentence coverage",
      usedFallback: false,
    },
  }
}

function safeJsonParse(jsonLike: string): Record<string, unknown> | null {
  try {
    const cleaned = jsonLike.replace(/```json\n?/gi, "").replace(/```\n?/gi, "").trim()
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    return null
  }
}

async function runLlmFallback(jobDescription: string, resumeText: string, reason: string): Promise<BertAtsAnalysis> {
  const prompt = `You are an ATS evaluator. Return ONLY JSON with these exact keys:
{
  "score": number,
  "matchLevel": "Excellent" | "Good" | "Fair" | "Poor",
  "skillsPresent": string[],
  "skillsMissing": string[],
  "missingKeywords": string[],
  "conceptualGaps": string[],
  "strengths": string[],
  "weaknesses": string[],
  "gameChangerTips": string[]
}

Evaluate this pair:
[JOB DESCRIPTION]
${jobDescription.slice(0, 7000)}

[RESUME]
${resumeText.slice(0, 7000)}`

  const response = await askLLM({
    message: prompt,
    systemHint: "Return strict JSON only. No markdown.",
    temperature: 0.1,
  })

  const parsed = safeJsonParse(response)

  const score = clamp(Number(parsed?.score ?? 55), 0, 100)
  const matchLevel = getMatchLevel(score)

  return {
    score,
    matchLevel,
    skillsPresent: Array.isArray(parsed?.skillsPresent) ? parsed?.skillsPresent.map(String) : [],
    skillsMissing: Array.isArray(parsed?.skillsMissing) ? parsed?.skillsMissing.map(String) : [],
    missingKeywords: Array.isArray(parsed?.missingKeywords) ? parsed?.missingKeywords.map(String) : [],
    conceptualGaps: Array.isArray(parsed?.conceptualGaps) ? parsed?.conceptualGaps.map(String) : ["Fallback analysis used because BERT model was unavailable."],
    strengths: Array.isArray(parsed?.strengths) ? parsed?.strengths.map(String) : ["Fallback ATS analysis produced with LLM."],
    weaknesses: Array.isArray(parsed?.weaknesses) ? parsed?.weaknesses.map(String) : ["BERT runtime was not available at request time."],
    gameChangerTips: Array.isArray(parsed?.gameChangerTips) ? parsed?.gameChangerTips.map(String) : ["Retry after BERT model download completes for deterministic semantic scoring."],
    bertMetadata: {
      model: `${resolvedBertModel} (fallback)`,
      analysisType: `LLM fallback due to BERT error: ${reason}`,
      usedFallback: true,
    },
  }
}

export async function analyzeAtsWithBert(jobDescription: string, resumeText: string): Promise<BertAtsAnalysis> {
  try {
    return await runBertAnalysis(jobDescription, resumeText)
  } catch (error) {
    const reason = getErrorMessage(error)
    console.warn(`BERT analysis failed, switching to LLM fallback: ${reason}`)

    try {
      return await runLlmFallback(jobDescription, resumeText, reason)
    } catch (fallbackError) {
      const fallbackReason = getErrorMessage(fallbackError)
      console.warn(`LLM fallback also failed: ${fallbackReason}`)

      return {
        score: 0,
        matchLevel: "Poor",
        skillsPresent: [],
        skillsMissing: [],
        missingKeywords: [],
        conceptualGaps: ["Analysis unavailable due to runtime error."],
        strengths: [],
        weaknesses: ["Both BERT and fallback analysis failed."],
        gameChangerTips: ["Retry after configuring API keys and model access."],
        bertMetadata: {
          model: `${resolvedBertModel} (failed)`,
          analysisType: `No analysis available. BERT error: ${reason}; fallback error: ${fallbackReason}`,
          usedFallback: true,
        },
      }
    }
  }
}
