import ChangeCard from "../components/ChangeCard";
import TrustLadder from "../components/TrustLadder";
import { prisma } from "@vigil/database";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Fetch the latest classified changes from the database
  const recentChanges = await prisma.classifiedChange.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Left Column: Change Feed */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">
              <span className="text-gradient-primary">Global Change Feed</span>
            </h1>
            <p className="text-muted">
              Live stream of API contract updates across all tracked vendors.
            </p>
          </div>
          <div className="px-4 py-2 bg-glass-bg border border-glass-border rounded-lg text-sm font-medium">
            <span className="text-accent-cyan font-bold">{recentChanges.length}</span> Updates
          </div>
        </div>

        {recentChanges.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-xl border-dashed">
            <p className="text-muted text-lg">No recent API changes detected.</p>
            <p className="text-sm mt-2 opacity-60">The Vigil spec-watcher is monitoring.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentChanges.map((change: any, index: number) => (
              <ChangeCard key={change.id} change={change} index={index} />
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Configuration & Status */}
      <div className="w-full lg:w-[400px] flex flex-col gap-6">
        <TrustLadder />
        
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4">System Status</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-glass-border">
              <span className="text-muted">spec-watcher</span>
              <span className="text-emerald-400 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Active
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-glass-border">
              <span className="text-muted">diff-classifier</span>
              <span className="text-emerald-400 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Active
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-glass-border">
              <span className="text-muted">sandbox-verifier</span>
              <span className="text-emerald-400 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Ready
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted">GitHub App</span>
              <span className="text-accent-cyan font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse" /> Connected
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
