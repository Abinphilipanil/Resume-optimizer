export function cleanText(text: string) {

  return text
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()

}