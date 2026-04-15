import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function parseGithub(url: string) {
  const username = url.replace("https://github.com/", "").split("/")[0];

  const user = await octokit.users.getByUsername({ username });
  const repos = await octokit.repos.listForUser({
    username,
    per_page: 20,
    sort: "updated",
  });

  const projects = repos.data
    .filter(r => !r.fork)
    .map(r => ({
      name: r.name,
      description: r.description,
      tech: [r.language],
      url: r.html_url,
      stars: r.stargazers_count,
    }));

  return {
    basics: {
      name: user.data.name,
      location: user.data.location,
      email: user.data.email,
      website: user.data.blog,
      github: user.data.html_url,
      summary: user.data.bio,
    },
    skills: [
      ...new Set(
        repos.data
          .map(r => r.language)
          .filter(Boolean)
      ),
    ],
    projects,
  };
}