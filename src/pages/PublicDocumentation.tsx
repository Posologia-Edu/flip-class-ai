import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import Documentation from "./Documentation";

export default function PublicDocumentation() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />
      <div className="flex-1">
        <Documentation showHeader={false} />
      </div>
      <PublicFooter />
    </div>
  );
}
