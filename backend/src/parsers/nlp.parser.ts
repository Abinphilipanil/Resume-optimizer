const SKILL_KEYWORDS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "Java",
  "MongoDB",
  "SQL",
  "AWS",
  "Docker",
  "Machine Learning",
  "NLP",
  "AI",
  "C++",
];

export function enhanceSkills(profile: any) {
  const text = JSON.stringify(profile).toLowerCase();

  const detected = SKILL_KEYWORDS.filter(skill =>
    text.includes(skill.toLowerCase())
  );

  profile.skills = [...new Set([...(profile.skills || []), ...detected])];

  return profile;
}