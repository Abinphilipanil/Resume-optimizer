import { Octokit } from "@octokit/rest"

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || undefined,
})

export type GithubData = {
  profile: {
    login: string
    name: string | null
    bio: string | null
    location: string | null
    blog: string | null
    company: string | null
    email: string | null
    followers: number
    following: number
    publicRepos: number
    avatarUrl: string
    htmlUrl: string
  }
  topRepositories: Array<{
    name: string
    htmlUrl: string
    description: string | null
    language: string | null
    stars: number
    forks: number
    topics: string[]
    updatedAt: string | null
  }>
  topLanguages: string[]
  totalStars: number
}

export async function parseGithubProfile(username: string): Promise<GithubData> {
  // Fetch user profile
  const userRes = await octokit.users.getByUsername({ username })

  // Fetch repos (limit to 30 most recently updated, not all 100)
  const repoRes = await octokit.repos.listForUser({
    username,
    per_page: 30,
    sort: "updated",
    type: "owner",
  })

  // Only use non-forked repos for better signal
  const ownRepos = repoRes.data.filter(r => !r.fork)

  // Calculate top languages
  const langCount: Record<string, number> = {}
  for (const repo of ownRepos) {
    if (repo.language) {
      langCount[repo.language] = (langCount[repo.language] || 0) + 1
    }
  }
  const topLanguages = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([lang]) => lang)

  // Total stars
  const totalStars = ownRepos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0)

  // Top 10 repos by stars + recency
  const topRepositories = ownRepos
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 10)
    .map(r => ({
      name: r.name,
      htmlUrl: r.html_url,
      description: r.description,
      language: r.language ?? null,
      stars: r.stargazers_count || 0,
      forks: r.forks_count || 0,
      topics: r.topics || [],
      updatedAt: r.updated_at ?? null,
    }))

  return {
    profile: {
      login: userRes.data.login,
      name: userRes.data.name,
      bio: userRes.data.bio,
      location: userRes.data.location,
      blog: userRes.data.blog || null,
      company: userRes.data.company,
      email: userRes.data.email || null,
      followers: userRes.data.followers,
      following: userRes.data.following,
      publicRepos: userRes.data.public_repos,
      avatarUrl: userRes.data.avatar_url,
      htmlUrl: userRes.data.html_url,
    },
    topRepositories,
    topLanguages,
    totalStars,
  }
}