"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  /** When set, property is fixed (e.g. property detail page). */
  lockedPropertyId?: string | null;
  defaults?: Defaults | null;
};

const PROPERTY_TYPES = [
  { value: "", label: "—" },
  { value: "house", label: "House" },
  { value: "unit", label: "Unit" },
  { value: "townhouse", label: "Townhouse" },
  { value: "apartment", label: "Apartment" },
];

export function LogSaleResultDialog({
  open,
  onOpenChange,
  agents,
  propertyOptions,
  lockedPropertyId,
  defaults,
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propById = useMemo(
    () => new Map(propertyOptions.map((p) => [p.id, p])),
    [propertyOptions],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
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
  }, [open, lockedPropertyId, defaults]);

  const effectivePropertyId = lockedPropertyId?.trim() || linkPropertyId.trim();

  function applyPropertySelection(id: string) {
    setLinkPropertyId(id);
    if (!id) return;
    const p = propById.get(id);
    if (!p) return;
    setAddress(p.address);
    setSuburb(p.suburb);
    setPostcode(p.postcode);
    if (p.bedrooms != null) setBedrooms(String(p.bedrooms));
    if (p.propertyType) setPropertyType(p.propertyType);
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
                  onChange={(e) => applyPropertySelection(e.target.value)}
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
