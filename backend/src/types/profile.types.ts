export interface NormalizedProfile {
  basics: {
    name?: string;
    headline?: string;
    location?: string;
    email?: string;
    website?: string;
    linkedin?: string;
    github?: string;
    summary?: string;
  };
  skills: string[];
  experience: any[];
  education: any[];
  projects: any[];
  certifications: string[];
  languages: string[];
  links: { label: string; url: string }[];
}
export interface GithubRepo {

  name: string
  description: string
  language: string
  stars: number

}

export interface GithubProfile {

  name: string
  bio: string
  followers: number
  publicRepos: number
  repositories: GithubRepo[]

}