import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

export async function parseResume(buffer: Buffer) {
  // Use PDFParse class (v2.x)
  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  const rawText = textResult.text;
  await parser.destroy();
  return {
    rawText
  };
}