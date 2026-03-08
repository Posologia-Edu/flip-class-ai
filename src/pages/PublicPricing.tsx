import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { PublicFooter } from "@/components/PublicFooter";
import FloatingAuth from "@/components/FloatingAuth";
import Pricing from "./Pricing";

export default function PublicPricing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold text-foreground">FlipClass</span>
        </Link>
        <FloatingAuth />
      </header>

      <div className="flex-1">
        <Pricing />
      </div>

      <PublicFooter />
    </div>
  );
}
