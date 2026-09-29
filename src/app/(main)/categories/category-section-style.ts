export function categorySectionSurface(type: "income" | "expense"): string {
  return type === "income"
    ? "bg-emerald-50/85 dark:bg-emerald-950/20"
    : "bg-rose-50/75 dark:bg-rose-950/15";
}
