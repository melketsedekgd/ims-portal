import Link from "next/link";
import { FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getDocuments } from "@/features/documents/queries";

export default async function DocumentsPage() {
  const documents = await getDocuments();

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1400px] mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold tracking-tight">Controlled Documents</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Procedures and work instructions under change control, and their current revision.
        </p>
      </div>

      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
            <TableRow>
              <TableHead className="h-10 pl-6">Document</TableHead>
              <TableHead className="h-10">Number</TableHead>
              <TableHead className="h-10">Current revision</TableHead>
              <TableHead className="h-10">Owner</TableHead>
              <TableHead className="h-10">Department</TableHead>
              <TableHead className="h-10 pr-6">Process</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                  No controlled documents are registered.
                </TableCell>
              </TableRow>
            ) : (
              documents.map((d) => (
                <TableRow key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <TableCell className="pl-6 font-medium">
                    <Link href={`/department/documents/${d.id}`} className="hover:underline">
                      {d.name}
                    </Link>
                    {d.status === "retired" && (
                      <Badge variant="outline" className="ml-2 text-[10px] text-muted-foreground">Retired</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">{d.documentNumber ?? "—"}</TableCell>
                  {/* null is "never published", not revision zero. */}
                  <TableCell className="text-sm font-mono">{d.currentRevision ?? "—"}</TableCell>
                  <TableCell className="text-sm">{d.ownerName ?? "—"}</TableCell>
                  <TableCell className="text-sm" title={d.department?.name}>{d.department?.code ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground pr-6">{d.processName ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
