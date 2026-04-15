import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { isSupabaseConfigured, supabase } from "../config/supabase.js"
import { getErrorMessage } from "../utils/error.js"

export type GeneratedResumeRecord = {
  id: string
  linkedin_url?: string | null
  github_url?: string | null
  job_description: string
  linkedin_data: Record<string, unknown>
  github_data: Record<string, unknown>
  generated_resume_markdown: string
  ats_score: number
  ats_analysis: unknown
  created_at: string
}

type SaveGeneratedResumeInput = Omit<GeneratedResumeRecord, "id" | "created_at">

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, "../../data")
const localFilePath = path.join(dataDir, "generated-resumes.json")

let supabaseFallbackLogged = false
let supabaseDisabledLogged = false
let useLocalOnly = false
let writeQueue: Promise<void> = Promise.resolve()
let columnsCache: Set<string> | null = null
let columnsLoadPromise: Promise<Set<string> | null> | null = null

function localId(): string {
  return `local-resume-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true })

  try {
    await fs.access(localFilePath)
  } catch {
    await fs.writeFile(localFilePath, "[]", "utf-8")
  }
}

async function readLocalRecords(): Promise<GeneratedResumeRecord[]> {
  await ensureDataFile()

  try {
    const raw = await fs.readFile(localFilePath, "utf-8")
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is GeneratedResumeRecord => {
      return item && typeof item === "object" && typeof item.id === "string"
    })
  } catch {
    return []
  }
}

async function writeLocalRecords(records: GeneratedResumeRecord[]): Promise<void> {
  await ensureDataFile()
  await fs.writeFile(localFilePath, JSON.stringify(records, null, 2), "utf-8")
}

function logSupabaseDisabledOnce(): void {
  if (supabaseDisabledLogged) return
  supabaseDisabledLogged = true
  console.info("Supabase not configured. Using local generated resume storage fallback.")
}

function logSupabaseFallbackOnce(reason: string): void {
  useLocalOnly = true
  if (supabaseFallbackLogged) return
  supabaseFallbackLogged = true
  console.warn(`Supabase generated resume storage unavailable (${reason}). Switching to local file storage.`)
}

function hasMissingColumnError(reason: string): boolean {
  return /column .* does not exist|Could not find the '.*' column/i.test(reason)
}

function hasMissingTableError(reason: string): boolean {
  return /Could not find the table .* in the schema cache|relation .* does not exist/i.test(reason)
}

function hasRlsError(reason: string): boolean {
  return /row-level security policy|permission denied/i.test(reason)
}

function normalizeSupabaseReason(reason: string): string {
  if (hasRlsError(reason)) {
    return "row-level security denied writes. Add SUPABASE_SERVICE_ROLE_KEY in backend/.env or create INSERT policy for anon/authenticated."
  }

  if (hasMissingTableError(reason) || hasMissingColumnError(reason)) {
    return `${reason}. Run backend/supabase_schema.sql in Supabase SQL Editor to sync schema.`
  }

  return reason
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeRemoteRecord(data: Record<string, unknown>): GeneratedResumeRecord {
  const resumeMarkdown =
    typeof data.generated_resume_markdown === "string"
      ? data.generated_resume_markdown
      : typeof data.resume_text === "string"
        ? data.resume_text
        : ""

  return {
    id: String(data.id || ""),
    linkedin_url: typeof data.linkedin_url === "string" ? data.linkedin_url : null,
    github_url: typeof data.github_url === "string" ? data.github_url : null,
    job_description: typeof data.job_description === "string" ? data.job_description : "",
    linkedin_data: asObject(data.linkedin_data),
    github_data: asObject(data.github_data),
    generated_resume_markdown: resumeMarkdown,
    ats_score: asNumber(data.ats_score, 0),
    ats_analysis: data.ats_analysis ?? {},
    created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
  }
}

async function loadSupabaseGeneratedResumeColumns(): Promise<Set<string> | null> {
  if (columnsCache) return columnsCache
  if (columnsLoadPromise) return columnsLoadPromise

  columnsLoadPromise = (async () => {
    const supabaseUrl = process.env.SUPABASE_URL?.trim()
    const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim()

    if (!supabaseUrl || !supabaseKey) {
      return null
    }

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: "application/openapi+json",
        },
      })

      if (!response.ok) {
        return null
      }

      const spec = (await response.json()) as {
        definitions?: Record<string, { properties?: Record<string, unknown> }>
      }
      const props = spec.definitions?.generated_resumes?.properties
      if (!props || typeof props !== "object") {
        return null
      }

      const columns = new Set(Object.keys(props))
      columnsCache = columns
      return columns
    } catch {
      return null
    } finally {
      columnsLoadPromise = null
    }
  })()

  return columnsLoadPromise
}

function buildPayloadCandidates(
  input: SaveGeneratedResumeInput,
  createdAt: string,
  knownColumns: Set<string> | null,
): Array<Record<string, unknown>> {
  if (knownColumns && knownColumns.size) {
    const payload: Record<string, unknown> = {}

    if (knownColumns.has("linkedin_url")) payload.linkedin_url = input.linkedin_url ?? null
    if (knownColumns.has("github_url")) payload.github_url = input.github_url ?? null
    if (knownColumns.has("job_description")) payload.job_description = input.job_description
    if (knownColumns.has("linkedin_data")) payload.linkedin_data = input.linkedin_data || {}
    if (knownColumns.has("github_data")) payload.github_data = input.github_data || {}
    if (knownColumns.has("generated_resume_markdown")) {
      payload.generated_resume_markdown = input.generated_resume_markdown
    }
    if (knownColumns.has("resume_text")) {
      payload.resume_text = input.generated_resume_markdown
    }
    if (knownColumns.has("ats_score")) payload.ats_score = input.ats_score ?? 0
    if (knownColumns.has("ats_analysis")) payload.ats_analysis = input.ats_analysis || {}
    if (knownColumns.has("created_at")) payload.created_at = createdAt

    return [payload]
  }

  return [
    {
      linkedin_url: input.linkedin_url ?? null,
      github_url: input.github_url ?? null,
      job_description: input.job_description,
      linkedin_data: input.linkedin_data || {},
      github_data: input.github_data || {},
      generated_resume_markdown: input.generated_resume_markdown,
      ats_score: input.ats_score ?? 0,
      ats_analysis: input.ats_analysis || {},
      created_at: createdAt,
    },
    {
      job_description: input.job_description,
      generated_resume_markdown: input.generated_resume_markdown,
      ats_score: input.ats_score ?? 0,
      created_at: createdAt,
    },
    {
      job_description: input.job_description,
      resume_text: input.generated_resume_markdown,
      ats_score: input.ats_score ?? 0,
      created_at: createdAt,
    },
    {
      job_description: input.job_description,
      resume_text: input.generated_resume_markdown,
    },
  ]
}

async function saveLocal(input: SaveGeneratedResumeInput): Promise<string> {
  const record: GeneratedResumeRecord = {
    id: localId(),
    ...input,
    created_at: new Date().toISOString(),
  }

  await (writeQueue = writeQueue.then(async () => {
    const records = await readLocalRecords()
    records.push(record)
    await writeLocalRecords(records)
  }))

  return record.id
}

export async function saveGeneratedResumeRecord(input: SaveGeneratedResumeInput): Promise<string | undefined> {
  if (useLocalOnly) {
    return saveLocal(input)
  }

  if (!isSupabaseConfigured || !supabase) {
    logSupabaseDisabledOnce()
    return saveLocal(input)
  }

  const createdAt = new Date().toISOString()

  try {
    const knownColumns = await loadSupabaseGeneratedResumeColumns()
    const payloads = buildPayloadCandidates(input, createdAt, knownColumns)
    let lastErrorMessage = "unknown storage error"

    for (const payload of payloads) {
      const { data, error } = await supabase
        .from("generated_resumes")
        .insert([payload])
        .select("id")
        .single()

      if (!error) {
        return data?.id
      }

      lastErrorMessage = error.message

      if (hasRlsError(error.message)) {
        break
      }

      if (hasMissingTableError(error.message)) {
        break
      }
    }

    logSupabaseFallbackOnce(normalizeSupabaseReason(lastErrorMessage))
    return saveLocal(input)
  } catch (error) {
    logSupabaseFallbackOnce(normalizeSupabaseReason(getErrorMessage(error)))
    return saveLocal(input)
  }
}

export async function getGeneratedResumeById(id: string): Promise<GeneratedResumeRecord | null> {
  if (!id) return null

  if (useLocalOnly || id.startsWith("local-resume-")) {
    const local = await readLocalRecords()
    return local.find((record) => record.id === id) ?? null
  }

  if (!isSupabaseConfigured || !supabase) {
    logSupabaseDisabledOnce()
    const local = await readLocalRecords()
    return local.find((record) => record.id === id) ?? null
  }

  try {
    const { data, error } = await supabase
      .from("generated_resumes")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (!error && data) {
      return normalizeRemoteRecord(data as Record<string, unknown>)
    }

    if (error) {
      logSupabaseFallbackOnce(normalizeSupabaseReason(error.message))
    }

    const local = await readLocalRecords()
    return local.find((record) => record.id === id) ?? null
  } catch (error) {
    logSupabaseFallbackOnce(normalizeSupabaseReason(getErrorMessage(error)))
    const local = await readLocalRecords()
    return local.find((record) => record.id === id) ?? null
  }
}
