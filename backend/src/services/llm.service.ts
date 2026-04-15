import axios from "axios"

export type LLMOptions = {
  message: string
  systemHint?: string
  temperature?: number
}

/**
 * Robust LLM service that prioritizes Groq (Llama 3.3 70B) for speed 
 * and falls back to Gemini if Groq is unavailable or hits limits.
 */
export async function askLLM({ message, systemHint, temperature = 0.2 }: LLMOptions): Promise<string> {
  const GROQ_KEY = process.env.GROQ_API_KEY
  const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"

  // ── Strategy 1: Attempt Groq ──
  if (GROQ_KEY) {
    try {
      console.log(`🚀 Groq: Analyzing using ${GROQ_MODEL}...`)
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: GROQ_MODEL,
          messages: [
            ...(systemHint ? [{ role: "system", content: systemHint }] : []),
            { role: "user", content: message }
          ],
          temperature
        },
        {
          headers: {
            "Authorization": `Bearer ${GROQ_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 10000 // 10s timeout for Groq
        }
      )

      const result = response.data?.choices?.[0]?.message?.content
      if (result) {
        console.log(`✅ Groq Success (Llama 3.3)`)
        return result
      }
    } catch (err: any) {
      console.warn(`⚠️  Groq failed or timed out: ${err.message}. Falling back to Gemini...`)
    }
  }

  // ── Strategy 2: Fallback to Gemini 2.0 ──
  return await askGeminiRaw(message, systemHint, temperature)
}

/**
 * Raw Gemini caller with built-in retries for 429 quota errors.
 */
async function askGeminiRaw(message: string, systemHint?: string, temperature: number = 0.2): Promise<string> {
	const apiKey = process.env.GEMINI_API_KEY;
	const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

	if (!apiKey) {
		throw new Error("GEMINI_API_KEY not set in .env");
	}

	console.log(`🔄 Gemini: Processing with ${model}...`);
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const contents = systemHint
    ? [
        { role: "user", parts: [{ text: systemHint }] },
        { role: "model", parts: [{ text: "Understood. I will follow these instructions strictly." }] },
        { role: "user", parts: [{ text: message }] },
      ]
    : [{ role: "user", parts: [{ text: message }] }]

  const maxRetries = 5
  let attempt = 0

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await axios.post(
        url,
        {
          contents,
          generationConfig: { temperature },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
        }
      )

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error("Empty response from Gemini")
      return text

    } catch (error: any) {
      attempt++
      if (error.response?.status === 429) {
        console.warn(`🚫 Gemini Quota (Attempt ${attempt}/5). Waiting 5s...`)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 5000))
          continue
        }
        throw new Error("Gemini Quota Exceeded. Please try again in 1 minute.")
      }
      
      const msg = error.response?.data?.error?.message || error.message
      throw new Error(`Gemini API Error: ${msg}`)
    }
  }

  throw new Error("Gemini request failed after retries")
}
