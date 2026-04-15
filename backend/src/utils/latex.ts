export type TemplateChoice = {
  id?: number
  name?: string
  category?: string
  file?: string
}

type LatexTheme = {
  accentHex: string
  sectionSpacing: string
  bodySize: string
}

function resolveTheme(templateChoice?: TemplateChoice | null): LatexTheme {
  const templateId = Number(templateChoice?.id || 0)
  const category = String(templateChoice?.category || "").toLowerCase()

  if (templateId === 1) {
    return { accentHex: "334155", sectionSpacing: "0.60em", bodySize: "10.5pt" }
  }
  if (templateId === 2) {
    return { accentHex: "64748B", sectionSpacing: "0.60em", bodySize: "10.5pt" }
  }
  if (templateId === 3) {
    return { accentHex: "0F172A", sectionSpacing: "0.45em", bodySize: "10pt" }
  }
  if (templateId === 4) {
    return { accentHex: "0F172A", sectionSpacing: "0.65em", bodySize: "10.5pt" }
  }
  if (templateId === 5) {
    return { accentHex: "1D4ED8", sectionSpacing: "0.65em", bodySize: "10.5pt" }
  }
  if (templateId === 6) {
    return { accentHex: "1E293B", sectionSpacing: "0.65em", bodySize: "10.5pt" }
  }
  if (templateId === 7) {
    return { accentHex: "7C3AED", sectionSpacing: "0.70em", bodySize: "10.5pt" }
  }
  if (templateId === 8) {
    return { accentHex: "0F766E", sectionSpacing: "0.70em", bodySize: "10.5pt" }
  }

  if (category.includes("minimal")) {
    return { accentHex: "475569", sectionSpacing: "0.60em", bodySize: "10.5pt" }
  }
  if (category.includes("executive")) {
    return { accentHex: "0F172A", sectionSpacing: "0.65em", bodySize: "10.5pt" }
  }
  if (category.includes("creative")) {
    return { accentHex: "2563EB", sectionSpacing: "0.70em", bodySize: "10.5pt" }
  }
  if (category.includes("academic")) {
    return { accentHex: "334155", sectionSpacing: "0.60em", bodySize: "10.5pt" }
  }

  return { accentHex: "1E293B", sectionSpacing: "0.65em", bodySize: "10.5pt" }
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim()
}

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}$&#_%])/g, "\\$1")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}")
}

function toLatexInline(text: string): string {
  return escapeLatex(stripInlineMarkdown(text))
}

function parseHeader(lines: string[]): { name: string; contact: string; contentStartIndex: number } {
  let index = 0

  while (index < lines.length && !lines[index].trim()) {
    index += 1
  }

  let name = "Candidate Name"
  let contact = ""

  if (index < lines.length && /^#\s+/.test(lines[index])) {
    name = lines[index].replace(/^#\s+/, "").trim() || name
    index += 1
  }

  while (index < lines.length && !lines[index].trim()) {
    index += 1
  }

  if (index < lines.length && !/^#{1,6}\s+/.test(lines[index])) {
    contact = lines[index].trim()
    index += 1
  }

  return { name, contact, contentStartIndex: index }
}

function renderSectionBody(sectionLines: string[]): string {
  const out: string[] = []
  let inList = false

  const closeList = () => {
    if (inList) {
      out.push("\\end{itemize}")
      inList = false
    }
  }

  for (const rawLine of sectionLines) {
    const line = rawLine.trim()

    if (!line) {
      closeList()
      continue
    }

    if (/^###\s+/.test(line)) {
      closeList()
      out.push(`\\textbf{${toLatexInline(line.replace(/^###\s+/, ""))}}\\\\`)
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push("\\begin{itemize}")
        inList = true
      }
      out.push(`\\item ${toLatexInline(line.replace(/^[-*]\s+/, ""))}`)
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      if (!inList) {
        out.push("\\begin{itemize}")
        inList = true
      }
      out.push(`\\item ${toLatexInline(line.replace(/^\d+\.\s+/, ""))}`)
      continue
    }

    closeList()
    out.push(`${toLatexInline(line)}\\\\`)
  }

  closeList()
  return out.join("\n")
}

function markdownToLatexSections(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  const { contentStartIndex } = parseHeader(lines)
  const out: string[] = []

  let currentTitle = ""
  let currentLines: string[] = []

  const flush = () => {
    if (!currentTitle) return
    out.push(`\\section*{${toLatexInline(currentTitle)}}`)
    out.push(renderSectionBody(currentLines))
    out.push("\\vspace{0.25em}")
  }

  for (let i = contentStartIndex; i < lines.length; i += 1) {
    const line = lines[i]
    const sectionMatch = line.match(/^##\s+(.+)$/)

    if (sectionMatch) {
      flush()
      currentTitle = sectionMatch[1].trim()
      currentLines = []
      continue
    }

    if (!currentTitle && line.trim()) {
      currentTitle = "Summary"
    }

    currentLines.push(line)
  }

  flush()
  return out.join("\n")
}

export function renderResumeLatex(markdown: string, templateChoice?: TemplateChoice | null): string {
  const lines = String(markdown || "").split(/\r?\n/)
  const { name, contact } = parseHeader(lines)
  const sections = markdownToLatexSections(String(markdown || ""))
  const theme = resolveTheme(templateChoice)
  const templateLabel = templateChoice?.name ? stripInlineMarkdown(templateChoice.name) : "Default Professional"

  const nameTex = toLatexInline(name)
  const contactTex = toLatexInline(contact)
  const templateTex = toLatexInline(templateLabel)

  return `\\documentclass[11pt,a4paper]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=0.62in]{geometry}
\\usepackage[hidelinks]{hyperref}
\\usepackage{enumitem}
\\usepackage[dvipsnames]{xcolor}
\\usepackage{titlesec}
\\usepackage{parskip}
\\pagenumbering{gobble}
\\setlength{\\parindent}{0pt}
\\setlist[itemize]{leftmargin=1.2em,noitemsep,topsep=1pt}
\\definecolor{AccentColor}{HTML}{${theme.accentHex}}
\\titleformat{\\section}{\\large\\bfseries\\color{AccentColor}}{}{0em}{}[\\vspace{0.15em}\\titlerule]
\\titlespacing*{\\section}{0pt}{${theme.sectionSpacing}}{0.35em}
\\begin{document}
{\\LARGE\\bfseries ${nameTex}}\\\\[4pt]
${contactTex ? `{\\small ${contactTex}}\\\\[2pt]` : ""}
{\\footnotesize Template: ${templateTex}}\\\\[2pt]
\\vspace{0.15em}
\\hrule
\\vspace{0.55em}
{\\fontsize{${theme.bodySize}}{13.5pt}\\selectfont
${sections}
}
\\end{document}
`
}
