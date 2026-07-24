import { defineSurfaceMap } from "@vigil/schemas";

export const githubSurfaceMap = defineSurfaceMap({
  vendorId: "github",
  entries: [
    {
      contractPath: "POST /repos/{owner}/{repo}/issues",
      typescript: {
        calleePatterns: ["octokit.rest.issues.create"]
      },
      python: {
        calleePatterns: ["github.Issue.create"]
      }
    }
  ]
});
