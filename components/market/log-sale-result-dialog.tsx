"use client";

import { Link2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  extractListingFromUrl,
  type ExtractedListingFields,
} from "@/app/actions/listings";
import { addSaleResult } from "@/app/actions/price-tracking";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SaleAgentOption = { id: string; name: string };
export type SalePropertyOption = {
  id: string;
  label: string;
  address: string;
  suburb: string;
  postcode: string;
  bedrooms: number | null;
  propertyType: string | null;
  /** YYYY-MM-DD when known */
  auctionDate?: string | null;
};

type Defaults = {
  address?: string;
  suburb?: string;
  postcode?: string;
  bedrooms?: number | null;
  propertyType?: string | null;
  propertyId?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: SaleAgentOption[];
  propertyOptions: SalePropertyOption[];
  lockedPropertyId?: string | null;
  defaults?: Defaults | null;
  /** Pre-filled listing URL (e.g. from ?logUrl=) */
  listingUrlSeed?: string | null;
};

const PROPERTY_TYPES = [
  { value: "", label: "—" },
  { value: "house", label: "House" },
  { value: "unit", label: "Unit" },
  { value: "townhouse", label: "Townhouse" },
  { value: "apartment", label: "Apartment" },
];

function parsePriceToNumber(s: string): number | null {
  if (!s?.trim()) return null;
  const digits = s.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

function mapListingPropertyTypeToForm(raw: string): string {
  const t = raw.toLowerCase();
  if (!t.trim()) return "";
  if (/town\s*house|townhouse/.test(t)) return "townhouse";
  if (/apartment|apt\b/.test(t)) return "apartment";
  if (/\bunit\b/.test(t)) return "unit";
  if (/\bhouse\b|detached|freestanding/.test(t)) return "house";
  return "";
}

function normalizeIsoDateFromListing(raw: string): string | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const dmY = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    const d = dmY[1].padStart(2, "0");
    const m = dmY[2].padStart(2, "0");
    const y = dmY[3];
    return `${y}-${m}-${d}`;
  }
  const parsed = Date.parse(t);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return undefined;
}

function matchAgentId(
  agentName: string,
  agents: SaleAgentOption[],
): string {
  const n = agentName.trim().toLowerCase();
  if (!n) return "";
  const exact = agents.find((a) => a.name.trim().toLowerCase() === n);
  if (exact) return exact.id;
  const partial = agents.find(
    (a) =>
      a.name.toLowerCase().includes(n) || n.includes(a.name.toLowerCase()),
  );
  return partial?.id ?? "";
}

function applyExtractedToForm(
  x: ExtractedListingFields,
  agents: SaleAgentOption[],
): {
  address: string;
  suburb: string;
  postcode: string;
  propertyType: string;
  bedrooms: string;
  salePrice: string;
  saleDate: string;
  agentId: string;
  notes: string;
} {
  const pt = mapListingPropertyTypeToForm(x.propertyType);
  const beds = x.bedrooms?.trim() ? x.bedrooms.replace(/\D/g, "") : "";
  const priceN = parsePriceToNumber(x.price);
  const auctionIso = normalizeIsoDateFromListing(x.auctionDate);
  const agentId = matchAgentId(x.agentName, agents);
  return {
    address: x.address?.trim() || "",
    suburb: x.suburb?.trim() || "",
    postcode: x.postcode?.trim() || "",
    propertyType: pt,
    bedrooms: beds,
    salePrice: priceN != null ? String(priceN) : "",
    saleDate:
      auctionIso ?? new Date().toISOString().slice(0, 10),
    agentId,
    notes: x.notes?.trim()
      ? `Source: ${x.listingUrl || "listing"}\n${x.notes.trim()}`.slice(0, 7500)
      : x.listingUrl
        ? `Source: ${x.listingUrl}`
        : "",
  };
}

export function LogSaleResultDialog({
  open,
  onOpenChange,
  agents,
  propertyOptions,
  lockedPropertyId,
  defaults,
  listingUrlSeed,
}: Props) {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [bedrooms, setBedrooms] = useState<string>("");
  const [salePrice, setSalePrice] = useState<string>("");
  const [saleDate, setSaleDate] = useState("");
  const [saleType, setSaleType] = useState("auction");
  const [reservePrice, setReservePrice] = useState<string>("");
  const [passedIn, setPassedIn] = useState(false);
  const [daysOnMarket, setDaysOnMarket] = useState<string>("");
  const [agentId, setAgentId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [linkPropertyId, setLinkPropertyId] = useState<string>("");
  const [listingUrl, setListingUrl] = useState("");
  const [savedPropertyPick, setSavedPropertyPick] = useState<string>("");
  const [extracting, setExtracting] = useState(false);
  const [extractOk, setExtractOk] = useState(false);
  const [extractErr, setExtractErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propById = useMemo(
    () => new Map(propertyOptions.map((p) => [p.id, p])),
    [propertyOptions],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setExtractErr(null);
    setExtractOk(false);
    setListingUrl(listingUrlSeed?.trim() ?? "");
    setSavedPropertyPick("");
    setAddress(defaults?.address?.trim() ?? "");
    setSuburb(defaults?.suburb?.trim() ?? "");
    setPostcode(defaults?.postcode?.trim() ?? "");
    setPropertyType(defaults?.propertyType?.trim() ?? "");
    setBedrooms(
      defaults?.bedrooms != null ? String(defaults.bedrooms) : "",
    );
    setSalePrice("");
    setSaleDate(new Date().toISOString().slice(0, 10));
    setSaleType("auction");
    setReservePrice("");
    setPassedIn(false);
    setDaysOnMarket("");
    setAgentId("");
    setNotes("");
    const lock = lockedPropertyId?.trim() ?? "";
    setLinkPropertyId(lock || (defaults?.propertyId?.trim() ?? ""));
  }, [open, lockedPropertyId, defaults, listingUrlSeed]);

  const effectivePropertyId = lockedPropertyId?.trim() || linkPropertyId.trim();

  function applyPropertyFromSaved(id: string) {
    setSavedPropertyPick(id);
    setLinkPropertyId(id);
    if (!id) return;
    const p = propById.get(id);
    if (!p) return;
    setAddress(p.address);
    setSuburb(p.suburb);
    setPostcode(p.postcode);
    if (p.bedrooms != null) setBedrooms(String(p.bedrooms));
    if (p.propertyType) {
      const mapped = mapListingPropertyTypeToForm(p.propertyType);
      setPropertyType(mapped || p.propertyType.toLowerCase());
    }
    const au = p.auctionDate?.trim();
    if (au) {
      const iso = normalizeIsoDateFromListing(au);
      if (iso) setSaleDate(iso);
    }
    setExtractOk(false);
    setExtractErr(null);
  }

  function onLinkPropertyOnly(id: string) {
    setLinkPropertyId(id);
    setSavedPropertyPick(id);
  }

  async function onExtractUrl() {
    const u = listingUrl.trim();
    if (!u) {
      setExtractErr("Paste a listing URL first.");
      return;
    }
    setExtracting(true);
    setExtractErr(null);
    setExtractOk(false);
    const res = await extractListingFromUrl(u);
    setExtracting(false);
    if (!res.ok) {
      setExtractErr(res.error);
      return;
    }
    const f = applyExtractedToForm(res.data, agents);
    if (f.address) setAddress(f.address);
    if (f.suburb) setSuburb(f.suburb);
    if (f.postcode) setPostcode(f.postcode);
    if (f.propertyType) setPropertyType(f.propertyType);
    if (f.bedrooms) setBedrooms(f.bedrooms);
    if (f.salePrice) setSalePrice(f.salePrice);
    if (f.saleDate) setSaleDate(f.saleDate);
    if (f.agentId) setAgentId(f.agentId);
    if (f.notes) setNotes((n) => (n.trim() ? `${n}\n\n${f.notes}` : f.notes));
    setExtractOk(true);
  }

  const showAuctionExtras = saleType === "auction";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await addSaleResult({
      address,
      suburb,
      postcode,
      propertyType: propertyType || null,
      bedrooms: bedrooms.trim() === "" ? null : Number(bedrooms),
      salePrice: Number(String(salePrice).replace(/,/g, "")),
      saleDate,
      saleType,
      reservePrice:
        showAuctionExtras && reservePrice.trim()
          ? Number(String(reservePrice).replace(/,/g, ""))
          : null,
      passedIn: showAuctionExtras ? passedIn : false,
      daysOnMarket: daysOnMarket.trim() === "" ? null : Number(daysOnMarket),
      agentId: agentId.trim() || null,
      notes: notes.trim() || null,
      propertyId: effectivePropertyId || null,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log sale result</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {!lockedPropertyId ? (
            <div>
              <label className="text-xs font-medium text-[#6B7280]">
                Select from saved properties
              </label>
              <select
                value={savedPropertyPick}
                onChange={(e) => applyPropertyFromSaved(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
              >
                <option value="">— Choose a saved property —</option>
                {propertyOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-[#6B7280]">
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              Paste a listing URL to autofill
            </label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={listingUrl}
                onChange={(e) => {
                  setListingUrl(e.target.value);
                  setExtractOk(false);
                  setExtractErr(null);
                }}
                placeholder="https://www.domain.com.au/…"
                className="min-w-0 flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 border-[#0D9488] text-[#0D9488]"
                disabled={extracting || !listingUrl.trim()}
                onClick={() => void onExtractUrl()}
              >
                {extracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extracting…
                  </>
                ) : (
                  "Extract →"
                )}
              </Button>
            </div>
            {extractOk ? (
              <p className="mt-1.5 text-sm font-medium text-emerald-600">
                Details extracted successfully
              </p>
            ) : null}
            {extractErr ? (
              <p className="mt-1.5 text-sm text-red-600" role="alert">
                {extractErr}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-[#6B7280]">
                Address
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7280]">
                Suburb
              </label>
              <input
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7280]">
                Postcode
              </label>
              <input
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7280]">
                Property type
              </label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
              >
                {PROPERTY_TYPES.map((o) => (
                  <option key={o.value || "empty"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7280]">
                Bedrooms
              </label>
              <input
                type="number"
                min={0}
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7280]">
                Sale price (AUD)
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">
                  $
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white py-2 pl-7 pr-3 text-sm tabular-nums"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7280]">
                Sale date
              </label>
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-[#6B7280]">
                Sale type
              </label>
              <select
                value={saleType}
                onChange={(e) => setSaleType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
              >
                <option value="auction">Auction</option>
                <option value="private_treaty">Private Treaty</option>
                <option value="expression_of_interest">
                  Expression of Interest
                </option>
              </select>
            </div>
            {showAuctionExtras ? (
              <>
                <div>
                  <label className="text-xs font-medium text-[#6B7280]">
                    Reserve price (optional)
                  </label>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={reservePrice}
                      onChange={(e) => setReservePrice(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white py-2 pl-7 pr-3 text-sm tabular-nums"
                    />
                  </div>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      checked={passedIn}
                      onChange={(e) => setPassedIn(e.target.checked)}
                      className="rounded border-[#E5E7EB]"
                    />
                    Passed in
                  </label>
                </div>
              </>
            ) : null}
            <div>
              <label className="text-xs font-medium text-[#6B7280]">
                Days on market (optional)
              </label>
              <input
                type="number"
                min={0}
                value={daysOnMarket}
                onChange={(e) => setDaysOnMarket(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7280]">
                Agent (optional)
              </label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-[#6B7280]">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
              />
            </div>
            {!lockedPropertyId ? (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-[#6B7280]">
                  Link to saved property (optional)
                </label>
                <select
                  value={linkPropertyId}
                  onChange={(e) => onLinkPropertyOnly(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                >
                  <option value="">— None —</option>
                  {propertyOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#0D9488] text-white hover:bg-[#0F766E]"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save result"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
