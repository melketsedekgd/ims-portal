import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface SlideOutSheetProps {
  title: string;
  description?: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function SlideOutSheet({
  title,
  description,
  isOpen,
  onClose,
  children
}: SlideOutSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-[500px] md:max-w-[600px] overflow-y-auto p-6 sm:p-8">
        <SheetHeader className="mb-6 space-y-1.5 text-left">
          <SheetTitle className="text-xl font-semibold">{title}</SheetTitle>
          {description && <SheetDescription className="text-sm">{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 w-full pb-8">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
