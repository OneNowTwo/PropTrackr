"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import {
  createProperty,
  type CreatePropertyState,
} from "@/app/actions/properties";
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

const selectClassName = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
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

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base">Listing details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          {state?.error ? (
            <p
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {state.error}
            </p>
          ) : null}

          <div className="grid gap-2">
            <label htmlFor="address" className="text-sm font-medium">
              Address <span className="text-destructive">*</span>
            </label>
            <Input
              id="address"
              name="address"
              required
              autoComplete="street-address"
              placeholder="Street address"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="suburb" className="text-sm font-medium">
                Suburb <span className="text-destructive">*</span>
              </label>
              <Input id="suburb" name="suburb" required />
            </div>
            <div className="grid gap-2">
              <label htmlFor="state" className="text-sm font-medium">
                State <span className="text-destructive">*</span>
              </label>
              <select
                id="state"
                name="state"
                required
                defaultValue=""
                className={selectClassName}
              >
                <option value="" disabled>
                  Select state
                </option>
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
              Postcode <span className="text-destructive">*</span>
            </label>
            <Input id="postcode" name="postcode" required />
          </div>

          <div className="grid gap-2">
            <label htmlFor="price" className="text-sm font-medium">
              Price (AUD)
            </label>
            <Input
              id="price"
              name="price"
              type="number"
              min={0}
              step={1}
              placeholder="Whole dollars, optional"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="propertyType" className="text-sm font-medium">
              Property type <span className="text-destructive">*</span>
            </label>
            <select
              id="propertyType"
              name="propertyType"
              required
              defaultValue=""
              className={selectClassName}
            >
              <option value="" disabled>
                Select type
              </option>
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
                type="number"
                min={0}
                step={1}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="bathrooms" className="text-sm font-medium">
                Bathrooms
              </label>
              <Input
                id="bathrooms"
                name="bathrooms"
                type="number"
                min={0}
                step={1}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="parking" className="text-sm font-medium">
                Parking spaces
              </label>
              <Input
                id="parking"
                name="parking"
                type="number"
                min={0}
                step={1}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label htmlFor="listingUrl" className="text-sm font-medium">
              Listing URL
            </label>
            <Input
              id="listingUrl"
              name="listingUrl"
              type="url"
              inputMode="url"
              placeholder="https://…"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes
            </label>
            <Textarea
              id="notes"
              name="notes"
              className="min-h-[120px] resize-y"
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
              defaultValue="saved"
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
  );
}
