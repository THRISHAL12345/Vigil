"use client";

import { motion } from "framer-motion";
import { ClassifiedChange } from "@vigil/schemas";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Info, PlusCircle, Trash2 } from "lucide-react";

export function ChangeCard({ change }: { change: ClassifiedChange }) {
  const isBreaking = change.classification === "breaking";
  const isNew = change.classification === "new_feature";
  const isDeprecation = change.classification === "deprecation";
  
  let Icon = Info;
  let colorClass = "text-non-breaking bg-non-breaking-bg border-non-breaking";
  
  if (isBreaking) {
    Icon = AlertTriangle;
    colorClass = "text-breaking bg-breaking-bg border-breaking";
  } else if (isNew) {
    Icon = PlusCircle;
    colorClass = "text-new-feature bg-new-feature-bg border-new-feature";
  } else if (isDeprecation) {
    Icon = Trash2;
    colorClass = "text-deprecation bg-deprecation-bg border-deprecation";
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01, translateY: -2 }}
      transition={{ duration: 0.3 }}
      className="glass-card rounded-xl p-6 relative overflow-hidden group cursor-default"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-current to-transparent opacity-50" />
      
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          <div className={`p-3 rounded-xl border flex items-center justify-center ${colorClass}`}>
            <Icon size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono uppercase tracking-wider text-muted font-semibold">
                {change.id.split("-")[0]}
              </span>
              <span className="text-xs text-muted/60">•</span>
              <span className="text-xs text-muted">
                {formatDistanceToNow(new Date(change.detectedAt), { addSuffix: true })}
              </span>
            </div>
            <h3 className="text-lg font-medium text-foreground tracking-tight leading-snug">
              {change.classification.replace("_", " ")}
            </h3>
            {change.ruleTriggered && (
              <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-muted border border-white/10 mt-2">
                Rule: {change.ruleTriggered}
              </div>
            )}
          </div>
        </div>
        
        <div className="text-right flex flex-col items-end">
          <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-white/10 bg-white/5">
            Confidence: {(change.confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="mt-5 p-4 rounded-lg bg-black/40 border border-white/5 font-mono text-sm text-foreground/80 leading-relaxed shadow-inner">
        {change.rationale}
      </div>
    </motion.div>
  );
}
