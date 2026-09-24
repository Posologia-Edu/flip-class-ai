import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import Pricing from "./Pricing";

export default function PublicPricing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <div className="flex-1">
        <Pricing />
      </div>

      <PublicFooter />
    </div>
  );
}
