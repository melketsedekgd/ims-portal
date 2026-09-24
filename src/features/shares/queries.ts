import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ShareItemType } from "./types";

export type ReceivedShare = {
  id: string;
  itemType: ShareItemType;
  itemCount: number;
  senderName: string;
  /** "Q2 2026" */
  period: string;
  note: string | null;
  createdAt: string;
  unread: boolean;
};

type ReceivedRow = {
  read_at: string | null;
  shares: {
    id: string;
    item_type: ShareItemType;
    note: string | null;
    created_at: string;
    sender: { full_name: string } | null;
    reporting_periods: { year: number; label: string } | null;
    share_items: { count: number }[];
  } | null;
};

/**
 * Shares sent to the signed-in user, newest first.
 *
 * The recipient filter is not a permission filter. RLS already limits
 * share_recipients to rows about the caller — but that includes every
 * recipient row of a share the caller sent, and this list is only what
 * they received.
 */
export async function getReceivedShares(userId: string): Promise<ReceivedShare[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("share_recipients")
    .select(
      `read_at,
       shares (
         id,
         item_type,
         note,
         created_at,
         sender:profiles!shares_sender_id_fkey ( full_name ),
         reporting_periods ( year, label ),
         share_items ( count )
       )`
    )
    .eq("recipient_id", userId)
    .returns<ReceivedRow[]>();

  if (error) throw error;

  return (data ?? [])
    .flatMap((r) => (r.shares ? [{ ...r.shares, read_at: r.read_at }] : []))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((s) => ({
      id: s.id,
      itemType: s.item_type,
      itemCount: s.share_items[0]?.count ?? 0,
      senderName: s.sender?.full_name ?? "Someone",
      period: s.reporting_periods ? `${s.reporting_periods.label} ${s.reporting_periods.year}` : "",
      note: s.note,
      createdAt: s.created_at,
      unread: s.read_at === null,
    }));
}

export type ShareDetail = {
  id: string;
  itemType: ShareItemType;
  senderId: string;
  senderName: string;
  year: number;
  quarter: string;
  note: string | null;
  createdAt: string;
  /** In the order they were ticked. */
  itemIds: string[];
  /** Everyone for the sender; only the caller's own row for a recipient. */
  recipients: { id: string; name: string; readAt: string | null }[];
};

type DetailRow = {
  id: string;
  item_type: ShareItemType;
  sender_id: string;
  note: string | null;
  created_at: string;
  sender: { full_name: string } | null;
  reporting_periods: { year: number; label: string } | null;
  share_items: { item_id: string; position: number }[];
  share_recipients: {
    recipient_id: string;
    read_at: string | null;
    profiles: { full_name: string } | null;
  }[];
};

/**
 * One share, or null. null is "no such id" and "not the sender or a
 * recipient" alike — RLS returns nothing for both, and the page shows the
 * same words for both, so it cannot confirm a share exists.
 */
export async function getShare(id: string): Promise<ShareDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shares")
    .select(
      `id,
       item_type,
       sender_id,
       note,
       created_at,
       sender:profiles!shares_sender_id_fkey ( full_name ),
       reporting_periods ( year, label ),
       share_items ( item_id, position ),
       share_recipients ( recipient_id, read_at, profiles ( full_name ) )`
    )
    .eq("id", id)
    .maybeSingle()
    .returns<DetailRow | null>();

  if (error || !data || !data.reporting_periods) return null;

  return {
    id: data.id,
    itemType: data.item_type,
    senderId: data.sender_id,
    senderName: data.sender?.full_name ?? "Someone",
    year: data.reporting_periods.year,
    quarter: data.reporting_periods.label,
    note: data.note,
    createdAt: data.created_at,
    itemIds: [...data.share_items]
      .sort((a, b) => a.position - b.position)
      .map((i) => i.item_id),
    recipients: data.share_recipients
      .map((r) => ({
        id: r.recipient_id,
        name: r.profiles?.full_name ?? "Someone",
        readAt: r.read_at,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
