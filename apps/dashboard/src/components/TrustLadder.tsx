"use client";

import { motion } from "framer-motion";
import { 
  ShieldCheck, 
  Eye, 
  GitPullRequestDraft, 
  Merge, 
  Lock 
} from "lucide-react";
import { useState } from "react";

const LADDER_STEPS = [
  {
    id: "read-only",
    title: "Read-Only Reports",
    description: "Vigil only reports detected changes in the dashboard. No code is modified.",
    icon: <Eye className="w-5 h-5" />,
    unlocked: true,
  },
  {
    id: "draft-prs",
    title: "Open Draft PRs",
    description: "Vigil opens verified draft PRs for breaking changes. Requires explicit manual merge.",
    icon: <GitPullRequestDraft className="w-5 h-5" />,
    unlocked: true,
  },
  {
    id: "auto-merge-minor",
    title: "Auto-Merge (Non-Breaking)",
    description: "Automatically merge non-breaking feature adoption patches.",
    icon: <Merge className="w-5 h-5" />,
    unlocked: false,
    lockReason: "V1 Restriction: Auto-merge is currently disabled globally for safety.",
  },
];

export default function TrustLadder() {
  const [activeStep, setActiveStep] = useState<string>("draft-prs");

  return (
    <div className="glass-panel rounded-xl p-6 relative overflow-hidden">
      {/* Decorative gradient orb */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent-purple/20 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 rounded-lg border border-glass-border">
          <ShieldCheck className="w-5 h-5 text-accent-purple" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Trust Ladder</h2>
          <p className="text-xs text-muted">Configure agent autonomy level</p>
        </div>
      </div>

      <div className="space-y-4">
        {LADDER_STEPS.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            onClick={() => step.unlocked && setActiveStep(step.id)}
            className={`
              relative p-4 rounded-xl border transition-all duration-300 cursor-pointer
              ${!step.unlocked ? 'opacity-50 cursor-not-allowed bg-black/40 border-glass-border' : ''}
              ${activeStep === step.id 
                ? 'bg-gradient-to-r from-accent-purple/10 to-transparent border-accent-purple/30 shadow-[inset_4px_0_0_var(--accent-purple)]' 
                : 'bg-glass-bg border-glass-border hover:bg-glass-highlight'}
            `}
          >
            <div className="flex items-start gap-4">
              <div className={`mt-0.5 p-1.5 rounded-lg ${activeStep === step.id ? 'text-accent-purple bg-accent-purple/10' : 'text-muted bg-black/50'}`}>
                {step.unlocked ? step.icon : <Lock className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <h3 className={`text-sm font-semibold mb-1 ${activeStep === step.id ? 'text-foreground' : 'text-foreground/80'}`}>
                  {step.title}
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  {step.unlocked ? step.description : step.lockReason}
                </p>
              </div>
              
              {step.unlocked && (
                <div className="flex items-center h-full pt-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${activeStep === step.id ? 'border-accent-purple bg-accent-purple/20' : 'border-muted/50'}`}>
                    {activeStep === step.id && <div className="w-1.5 h-1.5 rounded-full bg-accent-purple" />}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      
      <div className="mt-6 pt-5 border-t border-glass-border">
        <button className="w-full py-2.5 rounded-lg bg-gradient-to-r from-accent-purple to-accent-cyan text-background font-bold text-sm shadow-[0_0_20px_rgba(176,38,255,0.3)] hover:shadow-[0_0_25px_rgba(176,38,255,0.5)] transition-all">
          Save Configuration
        </button>
      </div>
    </div>
  );
}
