import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";

// Resolve directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const ENV_PATH = path.resolve(__dirname, "..", ".env");
dotenv.config({ path: ENV_PATH });

// Import routes
import githubRoutes from "./routes/github.routes.js";
import linkedinUrlRoutes from "./routes/linkedin.routes.js";
import resumeRoutes from "./routes/resume.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import builderRoutes from "./routes/builder.routes.js";
import linkedinPdfRoutes from "./routes/linkedinpdf.routes.js";

const app = express();

/*
 CORS configuration
 Add your Vercel frontend URL in production
*/
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      process.env.FRONTEND_URL,
    ],
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: "5mb" }));

// Health check (Render uses this often)
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// API Routes
app.use("/api/github", githubRoutes);
app.use("/api/linkedin-url", linkedinUrlRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/builder", builderRoutes);
app.use("/api/linkedin-pdf", linkedinPdfRoutes);

// Root test route
app.get("/", (req, res) => {
  res.send("Backend server running");
});

// Render provides PORT automatically
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});