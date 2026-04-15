import { PDFParse } from "pdf-parse"

export async function parseResume(buffer: Buffer) {
  // Use PDFParse class (v2.x)
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  
  // Clean up
  await parser.destroy()

  return {
    rawText: result.text
  }
}