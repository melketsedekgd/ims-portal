export type ShareItemType = "kpi" | "risk";

/** One row of list_share_recipients(): a person in one group. */
export type ShareRecipient = {
  profileId: string;
  fullName: string;
  jobTitle: string | null;
  groupCode: string;
  groupName: string;
};

/** "KPI" / "KPIs", "risk" / "risks". */
export function itemNoun(type: ShareItemType, count: number): string {
  if (type === "kpi") return count === 1 ? "KPI" : "KPIs";
  return count === 1 ? "risk" : "risks";
}
