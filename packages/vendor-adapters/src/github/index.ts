import { defineSurfaceMap } from "@vigil/schemas";

export const githubSurfaceMap = defineSurfaceMap({
  vendorId: "github",
  entries: [
    {
      contractPath: "POST /repos/{owner}/{repo}/issues",
      typescript: { calleePatterns: ["octokit.rest.issues.create"] },
      python: { calleePatterns: ["github.Issue.create"] }
    },
    {
      contractPath: "POST /repos/{owner}/{repo}/pulls",
      typescript: { calleePatterns: ["octokit.rest.pulls.create"] },
      python: { calleePatterns: ["github.PullRequest.create"] }
    },
    {
      contractPath: "POST /repos/{owner}/{repo}/releases",
      typescript: { calleePatterns: ["octokit.rest.repos.createRelease"] },
      python: { calleePatterns: ["github.Repository.create_git_release"] }
    },
    {
      contractPath: "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
      typescript: { calleePatterns: ["octokit.rest.actions.createWorkflowDispatch"] },
      python: { calleePatterns: ["github.Workflow.create_dispatch"] }
    }
  ]
});
