import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import UiverseLoader from "../components/UiverseLoader";

function Loading() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState("Preparing uploads...");
  const [errorMsg, setErrorMsg] = useState("");
  const isMounted = useRef(true);

  const safeParseJson = async (response, fallbackMessage) => {
    const rawText = await response.text();

    if (!rawText || !rawText.trim()) {
      throw new Error(fallbackMessage || "Server returned an empty response.");
    }

    try {
      return JSON.parse(rawText);
    } catch (error) {
      console.error("Invalid JSON response:", rawText);
      throw new Error("Server returned an invalid JSON response.");
    }
  };

  useEffect(() => {
    isMounted.current = true;

    const processFlow = async () => {
      try {
        const {
          github,
          jobDesc,
          linkedinFile,
          previousResumeFile,
          format,
          selectedTemplate,
        } = location.state || {};

if (!github || !jobDesc) {
  navigate("/upload", { replace: true });
  return;
}
        let parsedLinkedinData = null;
        let parsedPreviousResumeText = "";

        // 1. Upload & Parse LinkedIn PDF
        if (linkedinFile) {
          setStatus("Parsing LinkedIn Profile PDF...");

          const linkedInFormData = new FormData();
          linkedInFormData.append("file", linkedinFile);

          const linkedinRes = await fetch("/api/linkedin-pdf/parse-pdf", {
            method: "POST",
            body: linkedInFormData,
          });

          const linkedinJson = await safeParseJson(
            linkedinRes,
            "LinkedIn parser returned an empty response."
          );

          if (!linkedinRes.ok) {
            throw new Error(linkedinJson?.error || "LinkedIn parsing failed.");
          }

          parsedLinkedinData = linkedinJson.data;
          console.log("LinkedIn data parsed:", parsedLinkedinData);
        }

        // 2. Upload & Parse Optional Previous Resume
        if (previousResumeFile) {
          setStatus("Extracting details from your existing resume...");

          const resumeFormData = new FormData();
          resumeFormData.append("resume", previousResumeFile);

          const resumeRes = await fetch("/api/resume/upload", {
            method: "POST",
            body: resumeFormData,
          });

          const resumeJson = await safeParseJson(
            resumeRes,
            "Resume parser returned an empty response."
          );

          if (!resumeRes.ok) {
            throw new Error(resumeJson?.error || "Resume parsing failed.");
          }

          parsedPreviousResumeText = resumeJson.rawText || "";
          console.log("Previous resume extracted.");
        }

        // 3. Final Build step
          setStatus("AI is crafting your tailored ATS resume...");

        const effectiveFormat = selectedTemplate?.category || format || "Professional";
        const effectiveTemplateChoice = selectedTemplate
          ? { ...selectedTemplate, category: selectedTemplate.category || effectiveFormat }
          : null;

        const buildResponse = await fetch("/api/builder/build-from-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            github,
            jobDesc,
            linkedinPdfData: parsedLinkedinData,
            previousResumeText: parsedPreviousResumeText,
            format: effectiveFormat,
            templateChoice: effectiveTemplateChoice,
          }),
        });

        const buildData = await safeParseJson(
          buildResponse,
          "Resume builder returned an empty response."
        );

        if (!buildResponse.ok) {
          throw new Error(buildData?.error || `Server error ${buildResponse.status}`);
        }

        if (isMounted.current) {
          setStatus("Success! Saving results...");

          localStorage.setItem("resumeBuilt", "true");
          localStorage.setItem("generatedResume", buildData.resume || "");
          localStorage.setItem("generatedResumeLatex", buildData.resumeLatex || "");
          localStorage.setItem(
            "atsAnalysis",
            JSON.stringify(buildData.atsAnalysis || null)
          );
          localStorage.setItem(
            "linkedinFetched",
            String(buildData.linkedinFetched || !!parsedLinkedinData)
          );
          localStorage.setItem(
            "githubFetched",
            String(buildData.githubFetched || false)
          );
          localStorage.setItem("resumeDbId", buildData.dbId || "");
          localStorage.setItem("selectedTemplate", JSON.stringify(effectiveTemplateChoice));

          navigate("/success");
        }
      } catch (err) {
        console.error("Pipeline failed:", err);

        if (isMounted.current) {
          setErrorMsg(err?.message || "Something went wrong. Please try again.");
        }
      }
    };

    processFlow();

    return () => {
      isMounted.current = false;
    };
  }, [navigate, location.state]);

  if (errorMsg) {
    return (
      <div className="page">
        <div className="upload-card" style={{ textAlign: "center" }}>
          <h2 style={{ color: "#f87171", marginBottom: "16px" }}>⚠️ Error</h2>
          <p style={{ color: "#cbd5e1", marginBottom: "24px" }}>{errorMsg}</p>
          <button className="btn-primary" onClick={() => navigate("/upload")}>
            Go Back & Fix
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div
        className="upload-card"
        style={{ textAlign: "center", maxWidth: "600px" }}
      >
        <UiverseLoader />
        <h2
          style={{
            marginTop: "32px",
            marginBottom: "12px",
            background: "linear-gradient(to right, #fff, #94a3b8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Crafting Your Resume
        </h2>
        <p
          style={{
            color: "#94a3b8",
            marginBottom: "28px",
            fontSize: "16px",
            minHeight: "24px",
            fontWeight: "300",
          }}
        >
          {status}
        </p>
        <p
          style={{
            color: "#64748b",
            fontSize: "13px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            marginTop: "20px",
            paddingTop: "20px",
          }}
        >
          The AI engine is analyzing your profiles and tailoring everything to the
          job description.
        </p>
      </div>
    </div>
  );
}

export default Loading;
