/**
 * Today as YYYY-MM-DD in Africa/Addis_Ababa, the organisation's calendar.
 *
 * Not UTC: Addis is UTC+3, so between 00:00 and 03:00 local the UTC date is
 * still yesterday and an objective created then would start on the wrong
 * day. Plain module with no server or client imports — the form uses it
 * for the date picker's minimum, the schema and mutation for the check
 * and the stored start_date, so all three agree on what "today" is.
 */
export function todayInAddisAbaba(): string {
  // en-CA formats as YYYY-MM-DD with no locale-specific ordering.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
