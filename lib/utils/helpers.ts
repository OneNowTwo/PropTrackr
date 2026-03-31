export function formatAud(amount?: number | null) {
  if (amount == null) return "Price TBC";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}
