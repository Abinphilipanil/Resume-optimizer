import { lazy, Suspense, useEffect } from "react"
import { Route, Routes, useNavigate } from "react-router-dom"

import ProtectedRoute from "./pages/ProtectedRoute"

const Home = lazy(() => import("./pages/Home"))
const LinksUpload = lazy(() => import("./pages/LinksUpload"))
const ImportResume = lazy(() => import("./pages/ImportResume"))
const Loading = lazy(() => import("./pages/Loading"))
const Success = lazy(() => import("./pages/Success"))
const ATSCheck = lazy(() => import("./pages/ATSCheck"))
const ATSResult = lazy(() => import("./pages/ATSResult"))
const Chatbot = lazy(() => import("./pages/Chatbot"))

function RouteFallback() {
  return (
    <div className="page">
      <div className="upload-card" style={{ textAlign: "center" }}>
        <h2 style={{ marginBottom: "8px" }}>Loading</h2>
        <p style={{ color: "var(--text-muted)" }}>Preparing your experience...</p>
      </div>
    </div>
  )
}

function App() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleReload = () => {
      sessionStorage.setItem("reload", "true")
    }

    window.addEventListener("beforeunload", handleReload)

    if (sessionStorage.getItem("reload")) {
      sessionStorage.removeItem("reload")
      navigate("/")
    }

    return () => {
      window.removeEventListener("beforeunload", handleReload)
    }
  }, [navigate])

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          {/* <Route path="/templates" element={<TemplateSelect />} /> */}
          <Route path="/upload" element={<LinksUpload />} />
          <Route path="/import" element={<ImportResume />} />
          <Route path="/loading" element={<Loading />} />
          <Route path="/success" element={<Success />} />

          <Route
            path="/ats-check"
            element={
              <ProtectedRoute>
                <ATSCheck />
              </ProtectedRoute>
            }
          />

          <Route
            path="/ats-result"
            element={
              <ProtectedRoute>
                <ATSResult />
              </ProtectedRoute>
            }
          />

          <Route path="/chatbot" element={<Chatbot />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default App
