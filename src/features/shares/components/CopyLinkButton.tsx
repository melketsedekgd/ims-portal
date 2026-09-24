"use client"

import { useEffect, useState } from "react"
import { Check, Link2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/** The full URL of a share, for pasting into Teams or an email. */
export function shareUrl(shareId: string): string {
  return `${window.location.origin}/shared/${shareId}`
}

/** Copies the share's link; says "Copied" for two seconds. */
export default function CopyLinkButton({
  shareId,
  variant = "outline",
}: {
  shareId: string
  variant?: "outline" | "default"
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(shareId))
      setCopied(true)
    } catch {
      // No clipboard outside a secure context, or permission refused.
      toast.error("Couldn't copy. Select the link and copy it instead.")
    }
  }

  return (
    <Button variant={variant} onClick={copy}>
      {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  )
}
