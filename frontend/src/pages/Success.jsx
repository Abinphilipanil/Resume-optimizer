import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import Chatbot from "./Chatbot"

function normalizeResumeHeader(text) {
  const lines = String(text || "").split(/\r?\n/)

  while (lines.length > 0 && !lines[0].trim()) {
    lines.shift()
  }

  if (!lines.length) return String(text || "").trim()

  const firstLine = lines[0].trim()
  if (/^#\s+/.test(firstLine)) {
    lines[0] = firstLine.replace(/^#+\s+/, "# ")
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
  }

  let nameCandidate = firstLine
  let contactLine = ""

  const emailMatch = firstLine.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  if (emailMatch && typeof emailMatch.index === "number") {
    const beforeEmail = firstLine.slice(0, emailMatch.index).trim()
    if (beforeEmail) {
      nameCandidate = beforeEmail.replace(/[|,\-]+$/g, "").trim()
    }
    contactLine = firstLine.replace(nameCandidate, "").replace(/^[|,\-\s]+/, "").trim()
  } else if (firstLine.includes("|")) {
    const parts = firstLine
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean)

    if (parts.length >= 2) {
      nameCandidate = parts[0]
      contactLine = parts.slice(1).join(" | ")
    }
  }

  if (!/^[A-Za-z][A-Za-z .'-]{1,80}$/.test(nameCandidate)) {
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
  }

  lines[0] = `# ${nameCandidate}`
  if (contactLine) {
    lines.splice(1, 0, contactLine)
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

function sanitizeResume(text) {
  const cleaned = String(text || "")
    .replace(/<center>\s*/gi, "")
    .replace(/\s*<\/center>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<div>/gi, "")
    .replace(/<\/div>/gi, "")
    .replace(/^\s{0,3}(#{1,6}\s*)?header\s*$/gim, "")
    .replace(/^\s{0,3}(#{1,6}\s*)?contact\s+information\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return normalizeResumeHeader(cleaned)
}

function getTemplateClass(selectedTemplate) {
  const templateId = Number(selectedTemplate?.id)
  if (Number.isFinite(templateId) && templateId > 0) {
    return `template-id-${templateId}`
  }

  const category = String(selectedTemplate?.category || "Professional")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")

  return `template-${category || "professional"}`
}

async function safeParseJson(response) {
  const raw = await response.text()
  if (!raw || !raw.trim()) return {}

  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function Success() {
  const navigate = useNavigate()
  const [resume, setResume] = useState("")
  const [resumeLatex, setResumeLatex] = useState("")
  const [originalResume, setOriginalResume] = useState("")
  const [draftResume, setDraftResume] = useState("")
  const [activeTab, setActiveTab] = useState("preview")
  const [atsData, setAtsData] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [editStatus, setEditStatus] = useState("")
  const [recheckingAts, setRecheckingAts] = useState(false)

  const API_BASE =
    import.meta.env.MODE === "development"
      ? ""
      : (import.meta.env.VITE_API_URL || "").replace(/\/$/, "")

  useEffect(() => {
    const savedResume = localStorage.getItem("generatedResume") || localStorage.getItem("importedResumeText")
    const savedResumeLatex = localStorage.getItem("generatedResumeLatex") || ""
    const savedAts = localStorage.getItem("atsAnalysis")
    const savedTemplate = localStorage.getItem("selectedTemplate")

    if (savedResume) {
      const cleaned = sanitizeResume(savedResume)
      setResume(cleaned)
      setOriginalResume(cleaned)
      setDraftResume(cleaned)
    }
    setResumeLatex(savedResumeLatex)

    if (savedAts) {
      try {
        setAtsData(JSON.parse(savedAts))
      } catch {
        setAtsData(null)
      }
    }

    if (savedTemplate) {
      try {
        setSelectedTemplate(JSON.parse(savedTemplate))
      } catch {
        setSelectedTemplate(null)
      }
    }
  }, [])

  const persistResume = (nextResume) => {
    localStorage.setItem("generatedResume", nextResume)
    localStorage.setItem("importedResumeText", nextResume)
  }

  const handleApplyEdits = () => {
    const cleaned = sanitizeResume(draftResume)

    if (!cleaned) {
      setEditStatus("Resume content is empty. Please add text before updating.")
      return
    }

    setResume(cleaned)
    setDraftResume(cleaned)
    persistResume(cleaned)
    setActiveTab("preview")
    setEditStatus("Preview updated from your edits.")
  }

  const handleResetToOriginal = () => {
    if (!originalResume) return
    setResume(originalResume)
    setDraftResume(originalResume)
    persistResume(originalResume)
    setActiveTab("preview")
    setEditStatus("Restored to original generated resume.")
  }

  const handleRecheckAts = async () => {
    const cleaned = sanitizeResume(draftResume)
    if (!cleaned) {
      setEditStatus("Resume content is empty. Please add text before re-checking ATS.")
      return
    }

    const jobDesc = (sessionStorage.getItem("jobDesc") || localStorage.getItem("importedJobDesc") || "").trim()
    if (!jobDesc) {
      setEditStatus("Job description not found. Please add/import resume with a job description first.")
      return
    }

    setRecheckingAts(true)
    setEditStatus("")

    try {
      const response = await fetch(`${API_BASE}/api/resume/analyze-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: cleaned,
          jobDesc,
        }),
      })

      const json = await safeParseJson(response)

      if (!response.ok) {
        throw new Error(json?.error || `ATS re-check failed with status ${response.status}`)
      }

      setResume(cleaned)
      setDraftResume(cleaned)
      persistResume(cleaned)

      const analysis = json?.atsAnalysis || null
      setAtsData(analysis)
      localStorage.setItem("atsAnalysis", JSON.stringify(analysis))
      setActiveTab("preview")
      setEditStatus("ATS score updated using your edited resume.")
    } catch (error) {
      setEditStatus(error?.message || "ATS re-check failed. Please try again.")
    } finally {
      setRecheckingAts(false)
    }
  }

  const handleDownloadPDF = () => {
    const originalTitle = document.title
    document.title = "Resume"
    window.print()
    document.title = originalTitle
  }

  const handleDownloadMD = () => {
    const blob = new Blob([resume], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "resume.md"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadTEX = () => {
    const texContent = resumeLatex?.trim()
    if (!texContent) {
      setEditStatus("LaTeX output is not available for this resume yet.")
      return
    }

    const blob = new Blob([texContent], { type: "application/x-tex" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "resume.tex"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!resume) {
    return (
      <div className="page">
        <div className="upload-card" style={{ textAlign: "center" }}>
          <h2>No Resume Found</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>
            Please generate or import a resume first.
          </p>
          <button className="btn-primary" onClick={() => navigate("/")}>Go Home</button>
        </div>
      </div>
    )
  }

  const atsScore = atsData?.score || 0
  const scoreColor = atsScore >= 80 ? "#22c55e" : atsScore >= 50 ? "#fbbf24" : "#f87171"
  const skillsPresent = (atsData?.skillsPresent || atsData?.strengths || []).slice(0, 8)
  const skillsMissing = (atsData?.skillsMissing || atsData?.missingKeywords || []).slice(0, 8)
  const templateClassName = getTemplateClass(selectedTemplate)

  return (
    <div className="page" style={{ alignItems: "flex-start", paddingTop: "100px" }}>
      <div style={{ width: "100%", maxWidth: "1100px", margin: "0 auto" }}>
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "2.3rem", marginBottom: "6px" }}>Resume Dashboard</h1>
            <p style={{ color: "var(--text-muted)" }}>Clean preview and ATS feedback</p>
            {selectedTemplate?.name && (
              <p style={{ color: "#93c5fd", fontSize: "12px", marginTop: "4px" }}>
                Template style: {selectedTemplate.name} ({selectedTemplate.category || "Professional"})
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button className="btn-secondary" onClick={handleDownloadTEX} style={{ padding: "10px 20px" }}>TEX</button>
            <button className="btn-secondary" onClick={handleDownloadMD} style={{ padding: "10px 20px" }}>MD</button>
            <button className="btn-primary" onClick={handleDownloadPDF}>Download PDF</button>
          </div>
        </div>

        <div className="no-print" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "22px", marginBottom: "28px" }}>
          <div style={{ background: "var(--bg-card)", padding: "30px", borderRadius: "18px", border: "1px solid var(--glass-border)", textAlign: "center" }}>
            <div style={{ fontSize: "44px", fontWeight: 800, color: scoreColor }}>{atsScore}%</div>
            <div style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "8px" }}>ATS Match Score</div>
            <div style={{ marginTop: "10px", color: scoreColor, fontWeight: 700 }}>{atsData?.matchLevel || "ANALYZING"}</div>
          </div>

          <div style={{ background: "var(--bg-card)", padding: "30px", borderRadius: "18px", border: "1px solid var(--glass-border)" }}>
            <h3 style={{ marginBottom: "12px" }}>Skills Match Insight</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <p style={{ color: "#22c55e", fontSize: "12px", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Skills You Have
                </p>
                <p style={{ color: "#cbd5e1", marginBottom: "0", fontSize: "13px" }}>
                  {skillsPresent.length ? skillsPresent.join(", ") : "No strong skill matches detected yet."}
                </p>
              </div>
              <div>
                <p style={{ color: "#f87171", fontSize: "12px", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Skills You Lack
                </p>
                <p style={{ color: "#cbd5e1", marginBottom: "0", fontSize: "13px" }}>
                  {skillsMissing.length ? skillsMissing.join(", ") : "No critical missing skills detected."}
                </p>
              </div>
            </div>
            <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--text-muted)" }}>
              AI coach is now available as the final section at the bottom.
            </p>
          </div>
        </div>

        <div className="no-print" style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button className="btn-secondary" onClick={() => setActiveTab("preview")} style={{ padding: "10px 20px", background: activeTab === "preview" ? "var(--primary)" : "var(--glass-bg)", color: activeTab === "preview" ? "#020617" : "#fff" }}>
            Live Preview
          </button>
          <button className="btn-secondary" onClick={() => setActiveTab("markdown")} style={{ padding: "10px 20px", background: activeTab === "markdown" ? "var(--primary)" : "var(--glass-bg)", color: activeTab === "markdown" ? "#020617" : "#fff" }}>
            Source (Markdown)
          </button>
        </div>

        <div className={`resume-container resume-paper ${templateClassName}`}>
          {activeTab === "preview" ? (
            <div className="resume-md-content">
              <ReactMarkdown>{resume}</ReactMarkdown>
            </div>
          ) : (
            <pre style={{ whiteSpace: "pre-wrap", color: "#64748b", fontStyle: "italic", fontSize: "14px" }}>{resume}</pre>
          )}
        </div>

        <div className="no-print" style={{ marginTop: "24px", background: "var(--bg-card)", border: "1px solid var(--glass-border)", borderRadius: "18px", padding: "24px" }}>
          <h3 style={{ marginBottom: "10px" }}>Final Step: Edit Resume</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: "14px", fontSize: "13px" }}>
            Refine wording precisely, update preview, then re-check ATS score with your edited version.
          </p>

          <textarea
            value={draftResume}
            onChange={(e) => {
              setDraftResume(e.target.value)
              if (editStatus) setEditStatus("")
            }}
            style={{
              width: "100%",
              minHeight: "230px",
              resize: "vertical",
              background: "rgba(15, 23, 42, 0.65)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "10px",
              color: "#e2e8f0",
              padding: "14px",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          />

          <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={handleApplyEdits}>Update Preview</button>
            <button className="btn-secondary" onClick={handleRecheckAts} disabled={recheckingAts}>
              {recheckingAts ? "Re-checking ATS..." : "Re-check ATS"}
            </button>
            <button className="btn-secondary" onClick={handleResetToOriginal}>Reset Original</button>
          </div>

          {editStatus && (
            <p style={{ marginTop: "10px", fontSize: "13px", color: "#93c5fd" }}>{editStatus}</p>
          )}
        </div>

        <div className="no-print" style={{ marginTop: "24px", background: "var(--bg-card)", border: "1px solid var(--glass-border)", borderRadius: "18px", padding: "24px" }}>
          <h3 style={{ marginBottom: "8px" }}>Final Step: AI Career Coach</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: "14px", fontSize: "13px" }}>
            Ask for final, personalized improvements after your manual edits.
          </p>
          <Chatbot inline />
        </div>
      </div>
    </div>
  )
}

export default Success
