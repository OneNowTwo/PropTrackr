import Link from "next/link";
import { Sparkles } from "lucide-react";

function parseYmd(auctionDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(auctionDate.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d));
}

function utcDayStart(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function daysUntilAuction(auctionDate: string): number | null {
  const auction = parseYmd(auctionDate);
  if (!auction) return null;
  const now = new Date();
  const todayUtc = utcDayStart(now);
  const auctionUtc = utcDayStart(auction);
  return Math.round((auctionUtc - todayUtc) / 86_400_000);
}

function countdownPhrase(days: number): string {
  if (days < 0) {
    const n = Math.abs(days);
    return `${n} day${n === 1 ? "" : "s"} ago`;
  }
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

type Props = {
  propertyId: string;
  auctionDate: string | null;
  auctionTime: string | null;
  auctionVenue: string | null;
};

export function PropertyAuctionBanner({
  propertyId,
  auctionDate,
  auctionTime,
  auctionVenue,
}: Props) {
  const dateStr = auctionDate?.trim() ?? "";
  if (!dateStr) return null;

  const days = daysUntilAuction(dateStr);
  const countdown =
    days !== null ? countdownPhrase(days) : null;

  const timeStr = auctionTime?.trim() ?? "";
  const venueStr = auctionVenue?.trim() ?? "";

  return (
    <div
      className="rounded-xl border border-amber-600/25 px-5 py-4 shadow-sm"
      style={{ backgroundColor: "#F59E0B" }}
      role="region"
      aria-label="Auction details"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-sm font-bold uppercase tracking-wide text-amber-950">
            🔨 Auction
          </p>
          <p className="text-lg font-semibold text-amber-950">
            {dateStr}
            {timeStr ? ` · ${timeStr}` : null}
          </p>
          {venueStr ? (
            <p className="text-sm font-medium text-amber-950/95">{venueStr}</p>
          ) : null}
        </div>
        {countdown ? (
          <div className="shrink-0 rounded-lg bg-amber-950/10 px-4 py-2 text-center sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-950/80">
              Countdown
            </p>
            <p className="text-base font-bold text-amber-950">{countdown}</p>
          </div>
        ) : null}
      </div>
      <Link
        href={`/agent?context=auction&propertyId=${propertyId}`}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-950/20 bg-amber-950/10 px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-950/20"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Get auction strategy →
      </Link>
    </div>
  );
}
