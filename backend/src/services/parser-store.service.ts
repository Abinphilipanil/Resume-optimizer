import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { isSupabaseConfigured, supabase } from "../config/supabase.js"
import { getErrorMessage } from "../utils/error.js"

export type ParserSource = "github" | "linkedin_url" | "linkedin_pdf" | "resume"

export type ParserRecord = {
  id: string
  source: ParserSource
  source_key: string | null
  raw_text: string | null
  parsed_data: unknown
  created_at: string
}

type SaveParserRecordInput = {
  source: ParserSource
  sourceKey?: string | null
  rawText?: string | null
  parsedData: unknown
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, "../../data")
const localFilePath = path.join(dataDir, "parser-records.json")

let supabaseFallbackLogged = false
let supabaseDisabledLogged = false
let useLocalOnly = false
let writeQueue: Promise<void> = Promise.resolve()

function cleanSourceKey(sourceKey?: string | null): string | null {
  if (!sourceKey) return null
  return sourceKey.trim().toLowerCase().slice(0, 300)
}

function cleanRawText(rawText?: string | null): string | null {
  if (!rawText) return null
  return rawText.slice(0, 100000)
}

function buildLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true })

  try {
    await fs.access(localFilePath)
  } catch {
    await fs.writeFile(localFilePath, "[]", "utf-8")
  }
}

async function readLocalRecords(): Promise<ParserRecord[]> {
  await ensureDataFile()

  try {
    const raw = await fs.readFile(localFilePath, "utf-8")
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is ParserRecord => {
      return item && typeof item === "object" && typeof item.id === "string" && typeof item.source === "string"
    })
  } catch {
    return []
  }
}

async function writeLocalRecords(records: ParserRecord[]): Promise<void> {
  await ensureDataFile()
  await fs.writeFile(localFilePath, JSON.stringify(records, null, 2), "utf-8")
}

async function appendLocalRecord(record: ParserRecord): Promise<string> {
  await (writeQueue = writeQueue.then(async () => {
    const records = await readLocalRecords()
    records.push(record)
    await writeLocalRecords(records)
  }))

  return record.id
}

function logSupabaseDisabledOnce(): void {
  if (supabaseDisabledLogged) return
  supabaseDisabledLogged = true
  console.info("Supabase not configured. Using local parser storage fallback.")
}

function logSupabaseFallbackOnce(reason: string): void {
  useLocalOnly = true
  if (supabaseFallbackLogged) return
  supabaseFallbackLogged = true
  console.warn(`Supabase parser storage unavailable (${reason}). Switching to local parser storage.`)
}

function hasMissingTableError(reason: string): boolean {
  return /Could not find the table .*parser_records.* schema cache|relation .*parser_records.* does not exist/i.test(reason)
}

function hasRlsError(reason: string): boolean {
  return /row-level security policy|permission denied/i.test(reason)
}

function normalizeSupabaseReason(reason: string): string {
  if (hasMissingTableError(reason)) {
    return "table public.parser_records is missing. Run backend/supabase_schema.sql in Supabase SQL Editor."
  }

  if (hasRlsError(reason)) {
    return "row-level security denied writes. Add SUPABASE_SERVICE_ROLE_KEY in backend/.env or create parser_records policies for anon/authenticated."
  }

  return reason
}

async function saveParserRecordLocal(input: SaveParserRecordInput): Promise<string> {
  const localRecord: ParserRecord = {
    id: buildLocalId(),
    source: input.source,
    source_key: cleanSourceKey(input.sourceKey),
    raw_text: cleanRawText(input.rawText),
    parsed_data: input.parsedData,
    created_at: new Date().toISOString(),
  }

  return appendLocalRecord(localRecord)
}

function getLocalLatest(records: ParserRecord[], source: ParserSource, sourceKey?: string | null): ParserRecord | null {
  const normalizedKey = cleanSourceKey(sourceKey)

  const filtered = records.filter((record) => {
    if (record.source !== source) return false
    if (!normalizedKey) return true
    return record.source_key === normalizedKey
  })

  if (!filtered.length) return null

  filtered.sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return filtered[0]
}

export async function saveParserRecord(input: SaveParserRecordInput): Promise<string | null> {
  if (useLocalOnly) {
    return saveParserRecordLocal(input)
  }

  if (!isSupabaseConfigured || !supabase) {
    logSupabaseDisabledOnce()
    return saveParserRecordLocal(input)
  }

  try {
    const { data, error } = await supabase
      .from("parser_records")
      .insert([
        {
          source: input.source,
          source_key: cleanSourceKey(input.sourceKey),
          raw_text: cleanRawText(input.rawText),
          parsed_data: input.parsedData,
          created_at: new Date().toISOString(),
        },
      ])
      .select("id")
      .single()

    if (!error) {
      return data?.id ?? null
    }

    logSupabaseFallbackOnce(normalizeSupabaseReason(error.message))
    return saveParserRecordLocal(input)
  } catch (error) {
    logSupabaseFallbackOnce(normalizeSupabaseReason(getErrorMessage(error)))
    return saveParserRecordLocal(input)
  }
}

export async function getParserRecordById(id: string): Promise<ParserRecord | null> {
  if (!id) return null

  if (useLocalOnly) {
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
      .from("parser_records")
      .select("id,source,source_key,raw_text,parsed_data,created_at")
      .eq("id", id)
      .maybeSingle()

    if (!error && data) {
      return data as ParserRecord
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

export async function getLatestParserRecord(source: ParserSource, sourceKey?: string | null): Promise<ParserRecord | null> {
  if (useLocalOnly) {
    const local = await readLocalRecords()
    return getLocalLatest(local, source, sourceKey)
  }

  if (!isSupabaseConfigured || !supabase) {
    logSupabaseDisabledOnce()
    const local = await readLocalRecords()
    return getLocalLatest(local, source, sourceKey)
  }

  const normalized = cleanSourceKey(sourceKey)

  try {
    let query = supabase
      .from("parser_records")
      .select("id,source,source_key,raw_text,parsed_data,created_at")
      .eq("source", source)
      .order("created_at", { ascending: false })
      .limit(1)

    if (normalized) {
      query = query.eq("source_key", normalized)
    }

    const { data, error } = await query.maybeSingle()

    if (!error && data) {
      return data as ParserRecord
    }

    if (error) {
      logSupabaseFallbackOnce(normalizeSupabaseReason(error.message))
    }

    const local = await readLocalRecords()
    return getLocalLatest(local, source, sourceKey)
  } catch (error) {
    logSupabaseFallbackOnce(normalizeSupabaseReason(getErrorMessage(error)))
    const local = await readLocalRecords()
    return getLocalLatest(local, source, sourceKey)
  }
}
