// src/parsers/types.ts

export type SourceKind = "github" | "linkedin" | "resume";

export interface ParsedBasics {
  fullName?: string;
  headline?: string;
  location?: string;
  email?: string;
  phone?: string;
  summary?: string;
}

export interface ParsedLink {
  type: "github" | "linkedin" | "portfolio" | "repo" | "other";
  url: string;
  label?: string;
}

export interface ParsedSkill {
  name: string;
  confidence: number; // 0..1
  evidence: SourceKind[];
}

export interface ParsedProject {
  name: string;
  description?: string;
  tech?: string[];
  links?: ParsedLink[];
  confidence: number; // 0..1
  evidence: SourceKind[];
}

export interface ParsedExperience {
  company?: string;
  title?: string;
  location?: string;
  startDate?: string; // ISO-like "YYYY-MM" or "YYYY-MM-DD"
  endDate?: string;   // ISO-like or "present"
  bullets?: string[];
  confidence: number; // 0..1
  evidence: SourceKind[];
}

export interface ParsedEducation {
  school?: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  confidence: number; // 0..1
  evidence: SourceKind[];
}

export interface ParserOutput {
  source: SourceKind;
  basics: ParsedBasics;
  links: ParsedLink[];
  skills: ParsedSkill[];
  projects: ParsedProject[];
  experience: ParsedExperience[];
  education: ParsedEducation[];
  rawText?: string;      // when available (resume/linkedin)
  rawJson?: unknown;     // when available (github)
  warnings: string[];
}