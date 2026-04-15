import axios from "axios";
import * as cheerio from "cheerio";

export async function parseLinkedIn(url: string) {
  const response = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });

  const $ = cheerio.load(response.data);

  const name = $("h1").first().text().trim();
  const headline = $(".text-body-medium").first().text().trim();
  const location = $(".text-body-small").first().text().trim();

  const summary = $("#about").text().trim();

  const experience: any[] = [];
  $("section").each((_, section) => {
    const text = $(section).text();
    if (text.includes("Experience")) {
      $(section)
        .find("li")
        .each((_, el) => {
          experience.push({
            title: $(el).find("span").first().text(),
            description: $(el).text(),
          });
        });
    }
  });

  return {
    basics: {
      name,
      headline,
      location,
      linkedin: url,
      summary,
    },
    experience,
  };
}