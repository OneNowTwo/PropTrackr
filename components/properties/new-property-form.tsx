"use client";

import Link from "next/link";
import { Check, Link2, Loader2, Sparkles } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ClipboardEvent,
} from "react";
import { useFormState, useFormStatus } from "react-dom";

import {
  createProperty,
  type CreatePropertyState,
} from "@/app/actions/properties";
import { extractListingFromUrl } from "@/app/actions/listings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AU_STATES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
} from "@/lib/property-form-constants";
import { cn } from "@/lib/utils";
import type { InspectionDateSlot } from "@/lib/listing/inspection-autofill";

const initialState: CreatePropertyState = {};

const emptyForm = {
  listingUrl: "",
  imageUrl: "",
  imageUrls: [] as string[],
  address: "",
  suburb: "",
  state: "",
  postcode: "",
  price: "",
  bedrooms: "",
  bathrooms: "",
  parking: "",
  propertyType: "",
  notes: "",
  agentName: "",
  agencyName: "",
  agentPhotoUrl: "",
  agentEmail: "",
  agentPhone: "",
  status: "saved",
  inspectionDates: [] as InspectionDateSlot[],
  auctionDate: "",
  auctionTime: "",
  auctionVenue: "",
};

const selectClassName = cn(
  "flex h-9 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/30",
);

function coerceNotesSummary(notesSummary: unknown): string {
  return typeof notesSummary === "string"
    ? notesSummary
    : Array.isArray(notesSummary)
      ? notesSummary.join("\n")
      : String(notesSummary ?? "");
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-[#0D9488] font-semibold text-white hover:bg-[#0D9488]/90 sm:w-auto"
    >
      {pending ? "Saving…" : "Save property"}
    </Button>
  );
}

export function NewPropertyForm({
  initialListingUrl,
}: {
  initialListingUrl?: string | null;
}) {
  const [state, formAction] = useFormState(createProperty, initialState);
  const [f, setF] = useState(emptyForm);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [autofillInspectionCount, setAutofillInspectionCount] = useState<
    number | null
  >(null);
  const [isExtracting, startExtract] = useTransition();
  const appliedInitialUrl = useRef(false);

  const runExtractForUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setExtractError(null);
    setAutofillInspectionCount(null);
    startExtract(async () => {
      const result = await extractListingFromUrl(trimmed);
      if (!result.ok) {
        setExtractError(result.error);
        return;
      }
      const d = result.data;
      const n = d.inspectionDates?.length ?? 0;
      setAutofillInspectionCount(n > 0 ? n : null);
      setF((prev) => ({
        ...prev,
        listingUrl: d.listingUrl || trimmed,
        imageUrl: d.imageUrl || prev.imageUrl,
        imageUrls:
          d.imageUrls.length > 0 ? d.imageUrls : prev.imageUrls,
        address: d.address || prev.address,
        suburb: d.suburb || prev.suburb,
        state: d.state || prev.state,
        postcode: d.postcode || prev.postcode,
        price: d.price || prev.price,
        bedrooms: d.bedrooms || prev.bedrooms,
        bathrooms: d.bathrooms || prev.bathrooms,
        parking: d.parking || prev.parking,
        propertyType: d.propertyType || prev.propertyType,
        notes:
          coerceNotesSummary(d.notes).trim() || prev.notes,
        agentName: d.agentName || prev.agentName,
        agencyName: d.agencyName || prev.agencyName,
        agentPhotoUrl: d.agentPhotoUrl || prev.agentPhotoUrl,
        agentEmail: d.agentEmail || prev.agentEmail,
        agentPhone: d.agentPhone || prev.agentPhone,
        inspectionDates: d.inspectionDates ?? [],
        auctionDate: d.auctionDate ?? "",
        auctionTime: d.auctionTime ?? "",
        auctionVenue: d.auctionVenue ?? "",
      }));
    });
  }, []);

  const applyExtract = useCallback(() => {
    runExtractForUrl(f.listingUrl);
  }, [f.listingUrl, runExtractForUrl]);

  const handleListingUrlPaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text/plain").trim();
      if (!/^https?:\/\//i.test(text)) return;
      e.preventDefault();
      setF((p) => ({ ...p, listingUrl: text }));
      runExtractForUrl(text);
    },
    [runExtractForUrl],
  );

  useEffect(() => {
    const u = initialListingUrl?.trim();
    if (!u || appliedInitialUrl.current) return;
    appliedInitialUrl.current = true;
    setF((prev) => ({ ...prev, listingUrl: u }));
    runExtractForUrl(u);
  }, [initialListingUrl, runExtractForUrl]);

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border-2 border-[#0D9488]/25 bg-white shadow-md">
        <div className="border-b border-[#E5E7EB] bg-gradient-to-br from-[#ECFDF5] to-white px-6 pb-4 pt-6 sm:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0D9488] px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
              <Link2 className="h-3 w-3" aria-hidden />
              Smart import
            </span>
            <span className="text-xs font-medium text-[#6B7280]">
              Smart import reads the listing page
            </span>
          </div>
          <CardTitle className="mt-3 text-xl font-semibold text-[#111827] sm:text-2xl">
            Paste listing URL
          </CardTitle>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6B7280]">
            Put the link at the top — we fetch the page, extract address, price,
            beds, baths, parking, type, main photo, a short notes summary, and
            agent details (saved with the property). Review the form below, then
            save.
          </p>
        </div>
        <CardContent className="space-y-4 px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <label
                htmlFor="listingUrlTop"
                className="text-sm font-semibold text-[#111827]"
              >
                Listing URL
              </label>
              <Input
                id="listingUrlTop"
                value={f.listingUrl}
                onChange={(e) =>
                  setF((p) => ({ ...p, listingUrl: e.target.value }))
                }
                onPaste={handleListingUrlPaste}
                type="url"
                inputMode="url"
                placeholder="https://www.domain.com.au/… or https://www.realestate.com.au/…"
                className="h-11 border-[#E5E7EB] bg-white text-base text-[#111827] focus-visible:ring-[#0D9488]/35"
                autoComplete="off"
              />
            </div>
            <Button
              type="button"
              className="h-11 shrink-0 gap-2 bg-[#0D9488] font-medium text-white hover:bg-[#0D9488]/90"
              disabled={isExtracting || !f.listingUrl.trim()}
              onClick={applyExtract}
            >
              {isExtracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Autofill from URL
            </Button>
          </div>
          {extractError ? (
            <p
              className="rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              role="alert"
            >
              {extractError}
            </p>
          ) : null}
          {autofillInspectionCount != null && autofillInspectionCount > 0 ? (
            <p
              className="flex items-center gap-2 text-sm font-medium text-green-700"
              role="status"
            >
              <Check
                className="h-5 w-5 shrink-0 text-green-600"
                strokeWidth={2.5}
                aria-hidden
              />
              {autofillInspectionCount} inspection
              {autofillInspectionCount === 1 ? "" : "s"} added automatically
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-[#111827]">
            Listing details
          </CardTitle>
          <p className="text-sm text-[#6B7280]">
            Only address and suburb are required. Everything else is optional.
          </p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-5">
            <input type="hidden" name="listingUrl" value={f.listingUrl} />
            <input type="hidden" name="imageUrls" value={JSON.stringify(f.imageUrls)} />
            <input type="hidden" name="agentName" value={f.agentName} />
            <input type="hidden" name="agencyName" value={f.agencyName} />
            <input type="hidden" name="agentPhotoUrl" value={f.agentPhotoUrl} />
            <input type="hidden" name="agentEmail" value={f.agentEmail} />
            <input type="hidden" name="agentPhone" value={f.agentPhone} />
            <input
              type="hidden"
              name="inspectionDates"
              value={JSON.stringify(f.inspectionDates)}
            />
            <input type="hidden" name="auctionDate" value={f.auctionDate} />
            <input type="hidden" name="auctionTime" value={f.auctionTime} />
            <input type="hidden" name="auctionVenue" value={f.auctionVenue} />

            {state?.error ? (
              <p
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {state.error}
              </p>
            ) : null}

            <div className="grid gap-2">
              <label htmlFor="imageUrl" className="text-sm font-medium">
                Property photo URL
              </label>
              <Input
                id="imageUrl"
                name="imageUrl"
                value={f.imageUrl}
                onChange={(e) =>
                  setF((p) => ({ ...p, imageUrl: e.target.value }))
                }
                type="url"
                inputMode="url"
                placeholder="https://… (optional — shown on cards)"
                className="border-[#E5E7EB] bg-white text-[#111827]"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="address" className="text-sm font-medium">
                Address <span className="text-destructive">*</span>
              </label>
              <Input
                id="address"
                name="address"
                value={f.address}
                onChange={(e) =>
                  setF((p) => ({ ...p, address: e.target.value }))
                }
                required
                autoComplete="street-address"
                placeholder="Street address"
                className="border-[#E5E7EB] bg-white text-[#111827]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="suburb" className="text-sm font-medium">
                  Suburb <span className="text-destructive">*</span>
                </label>
                <Input
                  id="suburb"
                  name="suburb"
                  value={f.suburb}
                  onChange={(e) =>
                    setF((p) => ({ ...p, suburb: e.target.value }))
                  }
                  required
                  className="border-[#E5E7EB] bg-white text-[#111827]"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="state" className="text-sm font-medium">
                  State
                </label>
                <select
                  id="state"
                  name="state"
                  value={f.state}
                  onChange={(e) =>
                    setF((p) => ({ ...p, state: e.target.value }))
                  }
                  className={selectClassName}
                >
                  <option value="">Not specified</option>
                  {AU_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="postcode" className="text-sm font-medium">
                Postcode
              </label>
              <Input
                id="postcode"
                name="postcode"
                value={f.postcode}
                onChange={(e) =>
                  setF((p) => ({ ...p, postcode: e.target.value }))
                }
                className="border-[#E5E7EB] bg-white text-[#111827]"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="price" className="text-sm font-medium">
                Price (AUD)
              </label>
              <Input
                id="price"
                name="price"
                value={f.price}
                onChange={(e) => setF((p) => ({ ...p, price: e.target.value }))}
                type="number"
                min={0}
                step={1}
                placeholder="Whole dollars"
                className="border-[#E5E7EB] bg-white text-[#111827]"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="propertyType" className="text-sm font-medium">
                Property type
              </label>
              <select
                id="propertyType"
                name="propertyType"
                value={f.propertyType}
                onChange={(e) =>
                  setF((p) => ({ ...p, propertyType: e.target.value }))
                }
                className={selectClassName}
              >
                <option value="">Not specified</option>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <label htmlFor="bedrooms" className="text-sm font-medium">
                  Bedrooms
                </label>
                <Input
                  id="bedrooms"
                  name="bedrooms"
                  value={f.bedrooms}
                  onChange={(e) =>
                    setF((p) => ({ ...p, bedrooms: e.target.value }))
                  }
                  type="number"
                  min={0}
                  step={1}
                  className="border-[#E5E7EB] bg-white text-[#111827]"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="bathrooms" className="text-sm font-medium">
                  Bathrooms
                </label>
                <Input
                  id="bathrooms"
                  name="bathrooms"
                  value={f.bathrooms}
                  onChange={(e) =>
                    setF((p) => ({ ...p, bathrooms: e.target.value }))
                  }
                  type="number"
                  min={0}
                  step={1}
                  className="border-[#E5E7EB] bg-white text-[#111827]"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="parking" className="text-sm font-medium">
                  Parking spaces
                </label>
                <Input
                  id="parking"
                  name="parking"
                  value={f.parking}
                  onChange={(e) =>
                    setF((p) => ({ ...p, parking: e.target.value }))
                  }
                  type="number"
                  min={0}
                  step={1}
                  className="border-[#E5E7EB] bg-white text-[#111827]"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="notes" className="text-sm font-medium">
                Notes
              </label>
              <Textarea
                id="notes"
                name="notes"
                value={f.notes}
                onChange={(e) =>
                  setF((p) => ({ ...p, notes: e.target.value }))
                }
                className="min-h-[120px] resize-y border-[#E5E7EB] bg-white text-[#111827]"
                placeholder="Auction date, agent, impressions…"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="status" className="text-sm font-medium">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={f.status}
                onChange={(e) =>
                  setF((p) => ({ ...p, status: e.target.value }))
                }
                className={selectClassName}
              >
                {PROPERTY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#E5E7EB] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="ghost" type="button" asChild>
                <Link href="/properties">Cancel</Link>
              </Button>
              <SubmitButton />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
