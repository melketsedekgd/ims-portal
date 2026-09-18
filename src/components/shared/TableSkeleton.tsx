import { TableRow, TableCell } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

export function TableSkeleton({ columns = 4, rows = 3 }: { columns?: number, rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: columns }).map((_, j) => (
            <TableCell key={j} className={j === 0 ? "pl-6" : ""}>
              <Skeleton className={`h-5 ${j === 0 ? "w-[60%]" : "w-[80%]"}`} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
