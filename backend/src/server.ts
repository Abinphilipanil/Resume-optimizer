import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"

// ✅ Ensure .env is loaded
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ENV_PATH = path.resolve(__dirname, "..", ".env")
dotenv.config({ path: ENV_PATH })

import express from "express"
import cors from "cors"

import githubRoutes from "./routes/github.routes.js"
import linkedinUrlRoutes from "./routes/linkedin.routes.js"
import resumeRoutes from "./routes/resume.routes.js"
import chatRoutes from "./routes/chat.routes.js"
import builderRoutes from "./routes/builder.routes.js"
import linkedinPdfRoutes from "./routes/linkedinpdf.routes.js"

const app = express()
app.use(cors())
app.use(express.json({ limit: "5mb" }))

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }))

// API Routes
app.use("/api/github", githubRoutes)
app.use("/api/linkedin-url", linkedinUrlRoutes) // Renamed from /api/linkedin
app.use("/api/resume", resumeRoutes)
app.use("/api/chat", chatRoutes)
app.use("/api/builder", builderRoutes)
app.use("/api/linkedin-pdf", linkedinPdfRoutes) // Distinct path

const PORT = Number(process.env.PORT) || 8080
app.listen(PORT, () => console.log(`🚀 Server ready on http://localhost:${PORT}`))