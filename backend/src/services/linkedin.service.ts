import axios from "axios"
import { load } from "cheerio"

export type LinkedInData = {
  name: string
  headline: string
  about: string
  skills: string[]
  experience: string[]
  education: string[]
  rawText: string
  fetchedViaProfile: boolean
}

export async function parseLinkedin(url: string): Promise<LinkedInData> {
  // LinkedIn aggressively blocks scrapers (HTTP 999 / 403).
  // We do a best-effort attempt and return structured data with whatever we can extract.
  // The AI will still produce a full resume even if some fields are empty.

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })

    const $ = load(response.data)
    const rawText = $.root().text().replace(/\s+/g, " ").trim()

    // Try to extract as much as possible from the HTML
    const name =
      $("h1").first().text().trim() ||
      $("[data-field='title']").text().trim() ||
      ""

    const headline =
      $(".text-body-medium").first().text().trim() ||
      $("[data-field='headline']").text().trim() ||
      $(".pv-text-details__left-panel h2").text().trim() ||
      ""

    const about =
      $(".pv-shared-text-with-see-more .visually-hidden").remove().end().text().trim() ||
      $("[data-generated-suggestion-target='urn:li:fsd_profileSection:(ACoA']").text().trim() ||
      ""

    const skills: string[] = []
    $(".pv-skill-category-entity__name-text").each((_, el) => {
      skills.push($(el).text().trim())
    })

    const experience: string[] = []
    $(".pv-entity__summary-info h3").each((_, el) => {
      experience.push($(el).text().trim())
    })

    const education: string[] = []
    $(".pv-entity__school-name").each((_, el) => {
      education.push($(el).text().trim())
    })

    return {
      name,
      headline,
      about,
      skills,
      experience,
      education,
      rawText: rawText.slice(0, 3000), // limit to avoid token overflow
      fetchedViaProfile: true,
    }
  } catch (err: any) {
    // LinkedIn blocked us — return empty shell so Gemini can still build a resume
    console.warn(`LinkedIn parse failed (${err?.response?.status || err?.code || err?.message}) — will proceed with GitHub data only.`)
    return {
      name: "",
      headline: "",
      about: "",
      skills: [],
      experience: [],
      education: [],
      rawText: "",
      fetchedViaProfile: false,
    }
  }
}