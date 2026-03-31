"use client";

import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
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

const initialState: CreatePropertyState = {};

const emptyForm = {
  listingUrl: "",
  imageUrl: "",
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
  status: "saved",
};

const selectClassName = cn(
  "flex h-9 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Saving…" : "Save property"}
    </Button>
  );
}

export function NewPropertyForm() {
  const [state, formAction] = useFormState(createProperty, initialState);
  const [f, setF] = useState(emptyForm);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isExtracting, startExtract] = useTransition();

  const applyExtract = useCallback(() => {
    setExtractError(null);
    startExtract(async () => {
      const result = await extractListingFromUrl(f.listingUrl);
      if (!result.ok) {
        setExtractError(result.error);
        return;
      }
      const d = result.data;
      setF((prev) => ({
        ...prev,
        listingUrl: d.listingUrl || prev.listingUrl,
        imageUrl: d.imageUrl || prev.imageUrl,
        address: d.address || prev.address,
        suburb: d.suburb || prev.suburb,
        state: d.state || prev.state,
        postcode: d.postcode || prev.postcode,
        price: d.price || prev.price,
        bedrooms: d.bedrooms || prev.bedrooms,
        bathrooms: d.bathrooms || prev.bathrooms,
        parking: d.parking || prev.parking,
        propertyType: d.propertyType || prev.propertyType,
      }));
    });
  }, [f.listingUrl]);

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">
            Paste listing URL
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Domain, realestate.com.au, or any agent site — we&apos;ll fetch the
            page and use AI to pre-fill what we can. Edit anything before you
            save.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="listingUrlTop" className="text-sm font-medium">
              Listing URL
            </label>
            <Input
              id="listingUrlTop"
              value={f.listingUrl}
              onChange={(e) =>
                setF((p) => ({ ...p, listingUrl: e.target.value }))
              }
              type="url"
              inputMode="url"
              placeholder="https://www.domain.com.au/…"
              className="bg-white"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 gap-2 border border-border bg-white hover:bg-muted"
            disabled={isExtracting || !f.listingUrl.trim()}
            onClick={applyExtract}
          >
            {isExtracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary" />
            )}
            Autofill from URL
          </Button>
        </CardContent>
        {extractError ? (
          <CardContent className="pt-0">
            <p
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              role="alert"
            >
              {extractError}
            </p>
          </CardContent>
        ) : null}
      </Card>

      <Card className="border-border bg-card shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Listing details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Only address and suburb are required. Everything else is optional.
          </p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-5">
            <input type="hidden" name="listingUrl" value={f.listingUrl} />

            {state?.error ? (
              <p
                className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
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
                className="bg-white"
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
                className="bg-white"
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
                  className="bg-white"
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
                className="bg-white"
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
                className="bg-white"
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
                  className="bg-white"
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
                  className="bg-white"
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
                  className="bg-white"
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
                className="min-h-[120px] resize-y bg-white"
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

            <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
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
