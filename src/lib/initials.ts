/** "Abebe Kebede Tesfaye" -> "AK": first letters of the first two words. */
export function initials(fullName: string | null | undefined): string {
  const letters = (fullName ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
  return letters.toUpperCase() || "?"
}
