"use client";

import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { 
  AlertTriangle, 
  Info, 
  Trash2, 
  Sparkles, 
  ChevronRight,
  GitPullRequest
} from "lucide-react";
import { ClassifiedChange } from "@vigil/schemas";

interface ChangeCardProps {
  change: any;
  index: number;
}

export default function ChangeCard({ change, index }: ChangeCardProps) {
  const getClassificationConfig = (classification: string) => {
    switch (classification) {
      case "breaking":
        return {
          color: "text-breaking",
          bg: "bg-breaking-bg",
          border: "border-breaking-border",
          icon: <AlertTriangle className="w-4 h-4 text-breaking" />,
          label: "Breaking",
        };
      case "deprecation":
        return {
          color: "text-deprecation",
          bg: "bg-deprecation-bg",
          border: "border-deprecation-border",
          icon: <Trash2 className="w-4 h-4 text-deprecation" />,
          label: "Deprecation",
        };
      case "new_feature":
        return {
          color: "text-new-feature",
          bg: "bg-new-feature-bg",
          border: "border-new-feature-border",
          icon: <Sparkles className="w-4 h-4 text-new-feature" />,
          label: "New Feature",
        };
      default:
        return {
          color: "text-non-breaking",
          bg: "bg-non-breaking-bg",
          border: "border-non-breaking-border",
          icon: <Info className="w-4 h-4 text-non-breaking" />,
          label: "Non-Breaking",
        };
    }
  };

  const config = getClassificationConfig(change.classification);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`glass-panel rounded-xl overflow-hidden group hover:border-glass-highlight transition-all duration-300 relative`}
    >
      {/* Accent Line */}
      <div className={`absolute top-0 left-0 w-1 h-full ${config.bg} ${config.border} border-r`} />
      
      <div className="p-5 pl-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-lg text-foreground tracking-tight capitalize">
              {change.vendorId}
            </span>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${config.bg} ${config.border} ${config.color}`}>
              {config.icon}
              {config.label}
            </div>
          </div>
          <span className="text-xs text-muted font-medium bg-black/40 px-2 py-1 rounded-md border border-glass-border">
            {formatDistanceToNow(new Date(change.createdAt), { addSuffix: true })}
          </span>
        </div>

        <div className="mb-4 font-mono text-sm px-3 py-2 bg-black/50 rounded-lg border border-glass-border text-foreground/80 break-all">
          {change.path}
        </div>

        <p className="text-sm text-muted mb-6 line-clamp-2">
          {change.rationale}
        </p>

        <div className="flex items-center justify-between pt-4 border-t border-glass-border mt-auto">
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex flex-col">
              <span className="text-muted-foreground/60 mb-0.5">Confidence</span>
              <span className="text-foreground">{(change.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground/60 mb-0.5">Rule Triggered</span>
              <span className="text-foreground font-mono text-[10px]">{change.ruleTriggered || "llm_fallback"}</span>
            </div>
          </div>
          
          <button className="flex items-center gap-1.5 text-xs font-semibold text-accent-cyan hover:text-accent-purple transition-colors bg-accent-cyan/10 hover:bg-accent-purple/10 px-3 py-1.5 rounded-lg">
            <GitPullRequest className="w-3.5 h-3.5" />
            View Detail
            <ChevronRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
