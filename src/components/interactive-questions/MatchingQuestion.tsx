import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import type { QuestionComponentProps, MatchingQuestion as MQuestion } from "./types";

export default function MatchingQuestionComponent({ question, value, onChange, disabled }: QuestionComponentProps) {
  const q = question as MQuestion;
  const matches: Record<string, string> = value || {};
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  // Shuffle right column once
  const shuffledRight = useMemo(
    () => [...q.pairs].sort(() => Math.random() - 0.5).map((p) => p.right),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.question]
  );

  const handleSelect = (side: "left" | "right", item: string) => {
    if (disabled) return;

    if (side === "left") {
      if (selectedLeft === item) {
        setSelectedLeft(null);
      } else {
        setSelectedLeft(item);
      }
    } else if (side === "right" && selectedLeft) {
      // Remove any existing match to this right item
      const newMatches = { ...matches };
      Object.keys(newMatches).forEach((k) => {
        if (newMatches[k] === item) delete newMatches[k];
      });
      newMatches[selectedLeft] = item;
      onChange(newMatches);
      setSelectedLeft(null);
    }
  };

  const removeMatch = (left: string) => {
    if (disabled) return;
    const newMatches = { ...matches };
    delete newMatches[left];
    onChange(newMatches);
  };

  const matchedRights = new Set(Object.values(matches));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Clique em um item à esquerda, depois no correspondente à direita.</p>
      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Termos</p>
          {q.pairs.map((pair) => {
            const isMatched = !!matches[pair.left];
            const isActive = selectedLeft === pair.left;
            return (
              <button
                key={pair.left}
                type="button"
                disabled={disabled}
                onClick={() => handleSelect("left", pair.left)}
                className={`w-full text-left p-3 rounded-lg border-2 text-sm transition-all ${
                  isActive
                    ? "border-primary bg-primary/10"
                    : isMatched
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-secondary hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{pair.left}</span>
                  {isMatched && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); removeMatch(pair.left); }} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {isMatched && (
                  <p className="text-xs text-primary mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> {matches[pair.left]}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Definições</p>
          {shuffledRight.map((right) => {
            const isUsed = matchedRights.has(right);
            return (
              <button
                key={right}
                type="button"
                disabled={disabled || !selectedLeft}
                onClick={() => handleSelect("right", right)}
                className={`w-full text-left p-3 rounded-lg border-2 text-sm transition-all ${
                  isUsed
                    ? "border-muted bg-muted/50 text-muted-foreground"
                    : selectedLeft
                    ? "border-border bg-secondary hover:border-primary/50 cursor-pointer"
                    : "border-border bg-secondary opacity-60"
                }`}
              >
                {right}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
