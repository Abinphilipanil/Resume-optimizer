import { useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

function LinksUpload() {
  const navigate = useNavigate()
  const location = useLocation()

  const initialTemplate = location.state?.selectedTemplate || null

  const [github, setGithub] = useState("")
  const [jobDesc, setJobDesc] = useState("")
  const [linkedinFile, setLinkedinFile] = useState(null)
  const [previousResumeFile, setPreviousResumeFile] = useState(null)
  const [format, setFormat] = useState(location.state?.format || initialTemplate?.category || "Professional")
  const [selectedTemplate] = useState(initialTemplate)
  const [error, setError] = useState("")
  const isTemplateLocked = Boolean(selectedTemplate?.id)

  const linkedinInputRef = useRef(null)
  const resumeInputRef = useRef(null)

  const validate = () => {
    if (!github.trim() || !github.includes("github.com")) {
      return "Please enter a valid GitHub URL."
    }
    if (!linkedinFile) {
      return "LinkedIn PDF is required to build your professional profile."
    }
    if (!jobDesc.trim()) {
      return "Job description is required for ATS optimization."
    }
    return ""
  }

  const handleBuildResume = () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setError("")
    sessionStorage.setItem("jobDesc", jobDesc)
    const effectiveFormat = selectedTemplate?.category || format || "Professional"
    const effectiveTemplate = selectedTemplate
      ? { ...selectedTemplate, category: selectedTemplate.category || effectiveFormat }
      : null

    navigate("/loading", {
      state: {
        github,
        jobDesc,
        linkedinFile,
        previousResumeFile,
        format: effectiveFormat,
        selectedTemplate: effectiveTemplate,
      },
    })
  }

  return (
    <div className="page" style={{ paddingTop: "100px" }}>
      <div className="upload-card">
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h2
            style={{
              fontSize: "2rem",
              marginBottom: "8px",
              background: "linear-gradient(to right, #fff, #94a3b8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Build Your ATS Resume
          </h2>
          <p style={{ color: "var(--text-muted)" }}>
            Share your professional profiles to craft a template-aligned professional resume.
          </p>
          {selectedTemplate?.name && (
            <p style={{ marginTop: "10px", fontSize: "12px", color: "#93c5fd" }}>
              Selected template: {selectedTemplate.name} ({selectedTemplate.category})
            </p>
          )}
        </div>

        <div className="input-group">
          <label>GitHub Profile</label>
          <input
            type="text"
            placeholder="https://github.com/yourusername"
            value={github}
            onChange={(e) => setGithub(e.target.value)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>LinkedIn Profile (PDF)</label>
            <div
              onClick={() => linkedinInputRef.current?.click()}
              style={{
                border: "2px dashed rgba(0, 210, 255, 0.2)",
                padding: "20px 10px",
                borderRadius: "12px",
                cursor: "pointer",
                background: linkedinFile ? "rgba(34, 197, 94, 0.05)" : "rgba(255,255,255,0.02)",
                textAlign: "center",
                fontSize: "13px",
                color: linkedinFile ? "#4ade80" : "var(--text-muted)",
                transition: "all 0.3s",
              }}
            >
              {linkedinFile ? linkedinFile.name : "Upload PDF"}
            </div>
            <input
              type="file"
              accept=".pdf"
              ref={linkedinInputRef}
              style={{ display: "none" }}
              onChange={(e) => setLinkedinFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Existing Resume (Optional)</label>
            <div
              onClick={() => resumeInputRef.current?.click()}
              style={{
                border: "2px dashed rgba(255,255,255,0.1)",
                padding: "20px 10px",
                borderRadius: "12px",
                cursor: "pointer",
                background: previousResumeFile ? "rgba(59, 130, 246, 0.05)" : "rgba(255,255,255,0.02)",
                textAlign: "center",
                fontSize: "13px",
                color: previousResumeFile ? "#60a5fa" : "var(--text-muted)",
                transition: "all 0.3s",
              }}
            >
              {previousResumeFile ? previousResumeFile.name : "Upload PDF"}
            </div>
            <input
              type="file"
              accept=".pdf"
              ref={resumeInputRef}
              style={{ display: "none" }}
              onChange={(e) => setPreviousResumeFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div className="input-group">
          <label>Select Style</label>
          <select
            value={format}
            disabled={isTemplateLocked}
            onChange={(e) => {
              const next = e.target.value
              setFormat(next)
            }}
            style={{
              width: "100%",
              padding: "14px",
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "10px",
              color: "white",
              outline: "none",
            }}
          >
            <option value="Professional">Professional (Balanced)</option>
            <option value="Minimalist">Minimalist (Clean & concise)</option>
            <option value="Executive">Executive (Leadership-focused)</option>
            <option value="Academic">Academic (Detailed)</option>
            <option value="Creative">Creative (Modern but professional)</option>
          </select>
          {isTemplateLocked && (
            <p style={{ marginTop: "8px", fontSize: "12px", color: "#93c5fd" }}>
              Style is locked to your selected template from the template page.
            </p>
          )}
        </div>

        <div className="input-group">
          <label>Target Job Description</label>
          <textarea
            placeholder="Paste the job description you're targeting..."
            value={jobDesc}
            onChange={(e) => setJobDesc(e.target.value)}
            style={{ minHeight: "140px", resize: "vertical" }}
          />
        </div>

        {error && (
          <div
            style={{
              color: "#ef4444",
              marginBottom: "20px",
              fontSize: "14px",
              background: "rgba(239, 68, 68, 0.1)",
              padding: "10px",
              borderRadius: "8px",
            }}
          >
            {error}
          </div>
        )}

        <button className="btn-primary" onClick={handleBuildResume} style={{ width: "100%", height: "54px", fontSize: "1.1rem", marginTop: "10px" }}>
          Generate Resume
        </button>
        <p style={{ textAlign: "center", fontSize: "12px", color: "#64748b", marginTop: "16px" }}>
          Secure, encrypted, and real-time AI processing.
        </p>
      </div>
    </div>
  )
}

export default LinksUpload
