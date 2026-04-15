import axios from "axios";

export type GeminiModelListResponse = {
  models?: Array<{
    name?: string;
    version?: string;
    displayName?: string;
    description?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    supportedGenerationMethods?: string[];
  }>;
};

export async function listGeminiModels(): Promise<GeminiModelListResponse> {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) throw new Error("Missing GEMINI_API_KEY");

  const url = "https://generativelanguage.googleapis.com/v1beta/models";

  const resp = await axios.get<GeminiModelListResponse>(url, {
    headers: { "x-goog-api-key": API_KEY },
  });

  return resp.data; // contains models[]
}