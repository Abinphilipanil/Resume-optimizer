import express from "express";
import multer from "multer";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (dataBuffer: Buffer) => Promise<{ text: string }>;
import { parseGithub } from "../parsers/github.parser.js";
import { parseLinkedIn } from "../parsers/linkedin.parser.js";
import { enhanceSkills } from "../parsers/nlp.parser.js";
import { mergeProfiles } from "../utils/merge.js";

const router = express.Router();
const upload = multer();

router.post("/parse", upload.single("linkedinPdf"), async (req, res) => {
  try {
    const { githubUrl, linkedinUrl } = req.body;

    let githubData = {};
    let linkedinData = {};

    if (githubUrl) {
      githubData = await parseGithub(githubUrl);
    }

    if (linkedinUrl) {
      linkedinData = await parseLinkedIn(linkedinUrl);
    }

    if (req.file) {
      const pdfData = await pdfParse(req.file.buffer);
      linkedinData = { basics: { summary: pdfData.text } };
    }

    let merged = mergeProfiles(githubData, linkedinData);
    merged = enhanceSkills(merged);

    res.json({ success: true, profile: merged });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;