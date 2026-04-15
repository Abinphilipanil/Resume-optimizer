import { templates } from "../data/templates"
import { useNavigate } from "react-router-dom"
import { useMemo, useState } from "react"

function TemplateSelect() {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return templates

    return templates.filter((template) => {
      return (
        template.name.toLowerCase().includes(q) ||
        template.category.toLowerCase().includes(q) ||
        template.file.toLowerCase().includes(q)
      )
    })
  }, [search])

  return (
    <div className="page" style={{ paddingTop: "100px" }}>
      <div style={{ textAlign: "center", marginBottom: "50px" }}>
        <h1 style={{ fontSize: "3rem", marginBottom: "16px" }}>Choose Your Template</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1.2rem", marginBottom: "30px" }}>
          Every template is ATS compatible and tuned for a professional finish.
        </p>

        <div className="search-container" style={{ maxWidth: "500px", margin: "0 auto" }}>
          <input
            type="text"
            placeholder="Search templates (Minimalist, Executive, Creative...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 24px",
              borderRadius: "30px",
              border: "1px solid var(--glass-border)",
              background: "var(--glass-bg)",
              color: "white",
              fontSize: "1rem",
              outline: "none",
              transition: "0.3s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
          />
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto" }}>
        <div className="template-grid">
          {filteredTemplates.length > 0 ? (
            filteredTemplates.map((template) => (
              <div key={template.id} className="template-card" style={{ padding: "24px" }}>
                <div
                  style={{
                    overflow: "hidden",
                    borderRadius: "12px",
                    marginBottom: "20px",
                    height: "300px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0.2)",
                  }}
                >
                  <img
                    src={template.preview}
                    alt={`${template.name} preview`}
                    className="template-image"
                    style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s ease" }}
                    onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                    onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  />
                </div>

                <h3 style={{ fontSize: "1.25rem", marginBottom: "8px", color: "#fff" }}>{template.name}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "16px" }}>{template.category}</p>

                <div className="template-buttons">
                  <button className="btn-secondary" style={{ flex: 1, padding: "12px" }} onClick={() => window.open(template.file)}>
                    Preview
                  </button>

                  <button
                    className="btn-primary"
                    style={{ flex: 1.5, padding: "12px" }}
                    onClick={() => {
                      navigate("/upload", {
                        state: {
                          format: template.category,
                          selectedTemplate: {
                            id: template.id,
                            name: template.name,
                            category: template.category,
                            file: template.file,
                            preview: template.preview,
                          },
                        },
                      })
                    }}
                  >
                    Select & Continue
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", width: "100%", padding: "40px", color: "var(--text-muted)" }}>
              No templates found matching "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// This file has been removed as template selection is not required.
