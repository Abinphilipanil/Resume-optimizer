export const API_BASE =
  import.meta.env.MODE === "development"
    ? ""
    : (import.meta.env.VITE_API_URL || "")
        .replace(/\/$/, "")
        .replace(/\/api$/, "")

export function apiUrl(path) {
  return `${API_BASE}${path}`
}
