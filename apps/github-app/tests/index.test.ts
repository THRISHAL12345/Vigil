import { describe, it, expect, vi, beforeEach } from "vitest";
import { Probot, ProbotOctokit } from "probot";
import appFn from "../src/index.js";
import { prisma } from "@vigil/database";

// Mock the database
vi.mock("@vigil/database", () => ({
  prisma: {
    installation: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    }
  }
}));

describe("GitHub App", () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      appId: 123,
      privateKey: "test",
      // Disable request retries
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
      }),
    });
    // Load our app into probot
    probot.load(appFn);
    
    vi.clearAllMocks();
  });

  it("persists installation in DB on installation.created", async () => {
    const payload = {
      action: "created",
      installation: { id: 123456 },
      repositories: [
        { full_name: "test-user/test-repo" }
      ]
    };

    await probot.receive({ name: "installation", id: "test-id", payload } as any);
    
    expect(prisma.installation.create).toHaveBeenCalledWith({
      data: {
        repoFullName: "test-user/test-repo",
        installationId: "123456",
      }
    });
  });

  it("removes installation from DB on installation.deleted", async () => {
    const payload = {
      action: "deleted",
      installation: { id: 123456 },
    };

    await probot.receive({ name: "installation", id: "test-id", payload } as any);
    
    expect(prisma.installation.deleteMany).toHaveBeenCalledWith({
      where: { installationId: "123456" }
    });
  });
});
