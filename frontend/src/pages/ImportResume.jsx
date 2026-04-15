import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

function ImportResume() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleSelectFile = () => {
    if (!jobDesc.trim()) {
      setError("Please paste a job description first so ATS scoring can be calculated.");
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file.name);
    setError("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("jobDesc", jobDesc.trim());

      const res = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed");

      localStorage.setItem("importedResumeText", data.rawText || "");
      localStorage.setItem("resumeBuilt", "true");
      localStorage.setItem("importedJobDesc", jobDesc.trim());
      localStorage.setItem("atsAnalysis", JSON.stringify(data.atsAnalysis || null));

      navigate("/success");
    } catch (err) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page">
      <div className="upload-card" style={{ textAlign: "center", maxWidth: "680px" }}>
        <h2>Import Existing Resume</h2>
        <p style={{ color: "#94a3b8", marginBottom: "20px", fontSize: "14px" }}>
          Upload your current PDF resume and we will score ATS match against your target job description.
        </p>

        <div className="input-group" style={{ textAlign: "left", marginBottom: "20px" }}>
          <label htmlFor="import-job-desc">Job Description</label>
          <textarea
            id="import-job-desc"
            rows={8}
            placeholder="Paste the full job description here..."
            value={jobDesc}
            onChange={(e) => {
              setJobDesc(e.target.value);
              if (error) setError("");
            }}
            disabled={uploading}
            style={{ resize: "vertical" }}
          />
        </div>

        <input
          type="file"
          accept=".pdf"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <button className="btn-primary" onClick={handleSelectFile} disabled={uploading} style={{ width: "100%" }}>
          {uploading ? "Uploading..." : "Select PDF Resume"}
        </button>

        {selectedFile && (
          <p style={{ marginTop: "14px", color: "#94a3b8", fontSize: "13px" }}>
            File: {selectedFile}
          </p>
        )}

        {uploading && (
          <p style={{ color: "#64748b", fontSize: "12px", marginTop: "10px" }}>
            Parsing resume and calculating ATS score...
          </p>
        )}

        {error && (
          <p style={{ color: "#f87171", marginTop: "14px", fontSize: "13px" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export default ImportResume;
