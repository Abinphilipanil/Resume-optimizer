import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import SvgFrame from "../components/SvgFrame"
import FlashlightBackground from "../components/FlashlightBackground"
import { PROJECT_COORDINATOR, TEAM_MEMBERS } from "../data/team"

const DEFAULT_SPOTLIGHT = { x: 50, y: 20 }

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function Home() {
  const [darkMode, setDarkMode] = useState(true)
  const navigate = useNavigate()
  const memberRefs = useRef([])
  const teamMembers = useMemo(() => TEAM_MEMBERS, [])
  const [activeMemberIndex, setActiveMemberIndex] = useState(0)
  const [spotlightTarget, setSpotlightTarget] = useState(DEFAULT_SPOTLIGHT)

  useEffect(() => {
    if (teamMembers.length <= 1) return undefined

    const intervalId = window.setInterval(() => {
      setActiveMemberIndex((prev) => (prev + 1) % teamMembers.length)
    }, 2200)

    return () => window.clearInterval(intervalId)
  }, [teamMembers.length])

  const updateSpotlightFromActiveMember = useCallback(() => {
    const node = memberRefs.current[activeMemberIndex]
    if (!node || typeof window === "undefined") return

    const rect = node.getBoundingClientRect()
    if (!rect.width && !rect.height) return

    const xPercent = ((rect.left + rect.width / 2) / window.innerWidth) * 100
    const yPercent = ((rect.top + rect.height / 2) / window.innerHeight) * 100

    setSpotlightTarget({
      x: clamp(xPercent, 8, 92),
      y: clamp(yPercent, 12, 90),
    })
  }, [activeMemberIndex])

  useEffect(() => {
    updateSpotlightFromActiveMember()

    const onResize = () => updateSpotlightFromActiveMember()
    window.addEventListener("resize", onResize)

    return () => window.removeEventListener("resize", onResize)
  }, [updateSpotlightFromActiveMember])

  const handleMemberInteraction = useCallback((index) => {
    setActiveMemberIndex(index)
  }, [])

  useEffect(() => {
    document.body.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  return (
    <div className="page home-page">
      <FlashlightBackground spotlightTarget={spotlightTarget} />

      <div className="home-content">
        {/* Theme toggle removed as requested */}
        <SvgFrame />
        <h1>AR-10</h1>
        <p className="home-description">
          Craft professional, ATS-optimized resumes in seconds with our advanced neural engine and real-time profile integration.
        </p>

        <div className="home-buttons">
          <button className="btn-primary" onClick={() => navigate("/upload")}> 
            Get Started
          </button>
          <button className="btn-secondary" onClick={() => navigate("/import")}> 
            Import Resume
          </button>
        </div>

        <section className="team-spotlight-card">
          <h2>Project Team Spotlight</h2>
          <p className="team-label">Mini Project Coordinator</p>
          <div className="coordinator-pill">{PROJECT_COORDINATOR}</div>

          <p className="team-label">Core Team Members</p>
          <div className="team-members-grid">
            {teamMembers.map((member, index) => (
              <button
                key={`${member.name}-${index}`}
                type="button"
                ref={(node) => {
                  memberRefs.current[index] = node
                }}
                className={`team-member-chip ${activeMemberIndex === index ? "active" : ""}`}
                onMouseEnter={() => handleMemberInteraction(index)}
                onFocus={() => handleMemberInteraction(index)}
                onClick={() => handleMemberInteraction(index)}
              >
                <span className="team-member-name">{member.name}</span>
                <span className="team-member-role">{member.id}</span>
              </button>
            ))}
          </div>

          <p className="team-active-note">
            Spotlight on: <strong>{teamMembers[activeMemberIndex]?.name || "Team Member"}</strong>
          </p>
        </section>

        <section className="project-overview-card" style={{ marginTop: 40, background: 'var(--bg-card)', padding: 32, borderRadius: 16, maxWidth: 700, width: '100%' }}>
          <h2 style={{ marginBottom: 12 }}>Project Overview</h2>
          <p style={{ color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: 0 }}>
            This mini project is an AI-powered Resume Builder designed to help users create professional, ATS-optimized resumes quickly and efficiently. The system leverages advanced neural models and real-time profile integration to ensure your resume stands out and passes automated screening systems. Users can import existing resumes or enter their data, and the platform will guide them through the process, ensuring a seamless and modern experience.
          </p>
        </section>
      </div>
    </div>
  )
}

export default Home
