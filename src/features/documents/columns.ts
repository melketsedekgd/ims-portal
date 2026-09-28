import type { ColumnRegistry } from "@/lib/columns";

/**
 * The Requests page's two tables: the register of controlled documents and
 * the open requests waiting on others. Each table and its Columns panel
 * read these, in this order, and each is saved under its own key.
 */
export const DOCUMENT_COLUMN_KEYS = [
  "document",
  "number",
  "type",
  "revision",
  "reviewer",
  "department",
  "process",
] as const;

export type DocumentColumnKey = (typeof DOCUMENT_COLUMN_KEYS)[number];

export const DOCUMENT_COLUMNS: ColumnRegistry<DocumentColumnKey> = {
  tableKey: "documents",
  columns: [
    { key: "document", label: "Document", locked: true, exportWidth: 44 },
    { key: "number", label: "Number", exportWidth: 16 },
    { key: "type", label: "Type", extra: true, exportWidth: 18 },
    { key: "revision", label: "Current revision", exportWidth: 14 },
    { key: "reviewer", label: "Reviewer", exportWidth: 24 },
    { key: "department", label: "Department", exportWidth: 12 },
    { key: "process", label: "Process", exportWidth: 28 },
  ],
  presets: {
    minimal: ["document", "number", "revision"],
    default: ["document", "number", "revision", "reviewer", "department", "process"],
    detailed: DOCUMENT_COLUMN_KEYS,
  },
};

export const REQUEST_COLUMN_KEYS = [
  "document",
  "where",
  "request",
  "requester",
  "status",
  "raised",
  "waiting_since",
] as const;

export type RequestColumnKey = (typeof REQUEST_COLUMN_KEYS)[number];

export const REQUEST_COLUMNS: ColumnRegistry<RequestColumnKey> = {
  tableKey: "document_requests",
  columns: [
    { key: "document", label: "Document", locked: true, exportWidth: 44 },
    { key: "where", label: "Department / process", exportWidth: 28 },
    { key: "request", label: "Request", exportWidth: 18 },
    { key: "requester", label: "Requested by", extra: true, exportWidth: 24 },
    { key: "status", label: "Status", exportWidth: 24 },
    { key: "raised", label: "Raised", extra: true, exportWidth: 14 },
    { key: "waiting_since", label: "Waiting since", exportWidth: 14 },
  ],
  presets: {
    minimal: ["document", "request", "status"],
    default: ["document", "where", "request", "status", "waiting_since"],
    detailed: REQUEST_COLUMN_KEYS,
  },
};
