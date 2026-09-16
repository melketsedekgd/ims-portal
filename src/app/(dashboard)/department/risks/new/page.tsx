import Link from "next/link";
import { ArrowLeft, ShieldOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Not available yet. The mock form that lived here saved nothing; a real
 * createRisk also needs a baseline assessment, which is its own brief.
 * The register has no entrance to this route, so only a bookmarked or
 * typed URL reaches it — and it must not reach a form that pretends.
 */
export default function CreateRiskPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-[50vh] text-center px-6">
      <ShieldOff className="h-10 w-10 text-muted-foreground/30 mb-4" />
      <h2 className="text-xl font-semibold">Logging a risk isn&apos;t available yet</h2>
      <p className="text-muted-foreground text-sm mt-2 max-w-md">
        Risks are currently loaded from the quarterly reports. Assessments and
        treatment reviews against existing risks are recorded from the risk
        register.
      </p>
      <Link
        href="/department/risks"
        className={`${buttonVariants({ variant: "outline" })} mt-6`}
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Risks
      </Link>
    </div>
  );
}
