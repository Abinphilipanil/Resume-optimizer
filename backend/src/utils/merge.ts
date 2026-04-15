export function mergeProfiles(github: any, linkedin: any) {
  return {
    basics: { ...github.basics, ...linkedin.basics },
    skills: [...new Set([...(github.skills || []), ...(linkedin.skills || [])])],
    experience: linkedin.experience || [],
    education: linkedin.education || [],
    projects: github.projects || [],
    certifications: linkedin.certifications || [],
    languages: linkedin.languages || [],
    links: [
      ...(github.basics?.github ? [{ label: "GitHub", url: github.basics.github }] : []),
      ...(linkedin.basics?.linkedin ? [{ label: "LinkedIn", url: linkedin.basics.linkedin }] : []),
    ],
  };
}