import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { PublicFooter } from "@/components/PublicFooter";
import FloatingAuth from "@/components/FloatingAuth";
import Documentation from "./Documentation";

// This wraps the existing Documentation page with public header/footer
// Documentation already has its own header, so we just add footer
export default function PublicDocumentation() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1">
        <Documentation />
      </div>
      <PublicFooter />
    </div>
  );
}
