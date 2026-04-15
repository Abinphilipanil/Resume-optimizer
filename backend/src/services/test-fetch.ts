import { parseGithubProfile } from "./github.service.js";
import { parseLinkedin } from "./linkedin.service.js";

async function test() {
  console.log("Testing GitHub...");
  try {
    const gh = await parseGithubProfile("defunkt");
    console.log("GitHub Success:", gh.profile.name, gh.topRepositories.length);
  } catch (e: any) {
    console.error("GitHub Error:", e.message || e);
  }

  console.log("\nTesting LinkedIn...");
  try {
    const li = await parseLinkedin("https://www.linkedin.com/in/abinphilipanil");
    console.log("LinkedIn Success:", li.name, li.headline);
  } catch (e: any) {
    console.error("LinkedIn Error:", e.message || e);
  }
}
test();
