"use client";

import { useEffect, useState } from "react";
import { ClassifiedChange } from "@vigil/schemas";
import { ChangeCard } from "../components/ChangeCard";
import { Loader2, Activity } from "lucide-react";

export default function Home() {
  const [changes, setChanges] = useState<ClassifiedChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFeed() {
      try {
        const res = await fetch("http://localhost:3000/api/v1/feed");
        if (!res.ok) throw new Error("Failed to fetch feed");
        const data = await res.json();
        setChanges(data.changes || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    
    fetchFeed();
  }, []);

  return (
    <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <header className="mb-12 space-y-4">
        <div className="flex items-center gap-3 text-breaking">
          <Activity size={32} />
          <h1 className="text-4xl font-bold tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            Global Change Feed
          </h1>
        </div>
        <p className="text-muted text-lg max-w-2xl leading-relaxed">
          Real-time updates of API changes detected across all tracked vendors. 
          Vigil automatically maps these changes to affected codebases.
        </p>
      </header>

      <main className="space-y-6 relative">
        {loading && (
          <div className="flex items-center justify-center py-20 text-muted">
            <Loader2 className="animate-spin w-8 h-8" />
          </div>
        )}

        {error && (
          <div className="p-6 rounded-xl bg-breaking/10 border border-breaking/20 text-breaking">
            Error loading feed: {error}
          </div>
        )}

        {!loading && !error && changes.length === 0 && (
          <div className="p-12 text-center rounded-xl border border-white/5 bg-white/[0.02] text-muted">
            No changes detected yet. Waiting for vendor spec updates...
          </div>
        )}

        {!loading && changes.map((change) => (
          <ChangeCard key={change.id} change={change} />
        ))}
      </main>
    </div>
  );
}
