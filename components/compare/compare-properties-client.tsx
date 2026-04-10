"use client";

import { ExternalLink, GitCompareArrows, Loader2, Sparkles } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  generateComparisonVerdict,
  getComparison,
} from "@/app/actions/comparisons";
import { useAigent } from "@/components/agent/aigent-modal";
import { ComparePropertyPhotos } from "@/components/compare/compare-property-photos";
import { VerdictMarkdown } from "@/components/compare/verdict-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Property } from "@/types/property";
import { cn, formatAud } from "@/lib/utils";

const selectClassName = cn(
  "flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/30",
);

function statusBadgeVariant(
  status: Property["status"],
): "success" | "default" | "muted" | "secondary" {
  switch (status) {
    case "shortlisted":
      return "success";
    case "inspecting":
      return "default";
    case "passed":
      return "muted";
    default:
      return "secondary";
  }
}

function formatStatusLabel(status: Property["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function notesToBullets(notes: string | null): string[] {
  if (!notes?.trim()) return [];
  return notes
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      if (l.startsWith("•")) return l;
      if (l.startsWith("- ") || l.startsWith("* ")) return `• ${l.slice(2)}`;
      return `• ${l}`;
    });
}

function betterLower(
  a: number | null,
  b: number | null,
): "a" | "b" | "tie" | null {
  if (a == null && b == null) return null;
  if (a == null) return "b";
  if (b == null) return "a";
  if (a < b) return "a";
  if (b < a) return "b";
  return "tie";
}

function betterHigher(
  a: number | null,
  b: number | null,
): "a" | "b" | "tie" | null {
  if (a == null && b == null) return null;
  if (a == null) return "b";
  if (b == null) return "a";
  if (a > b) return "a";
  if (b > a) return "b";
  return "tie";
}

const highlight = "font-semibold text-[#0D9488]";

type Props = {
  properties: Property[];
};

export function ComparePropertiesClient({ properties }: Props) {
  const { open: openAigent } = useAigent();
  const [propertyAId, setPropertyAId] = useState("");
  const [propertyBId, setPropertyBId] = useState("");
  const [verdict, setVerdict] = useState<{
    text: string;
    createdAt: string;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [pendingLoad, startLoad] = useTransition();
  const [pendingGen, startGen] = useTransition();

  const byId = useMemo(() => {
    const m = new Map<string, Property>();
    for (const p of properties) m.set(p.id, p);
    return m;
  }, [properties]);

  const propA = propertyAId ? byId.get(propertyAId) : undefined;
  const propB = propertyBId ? byId.get(propertyBId) : undefined;
  const pairReady =
    Boolean(propA && propB && propertyAId !== propertyBId);

  const loadVerdict = useCallback(() => {
    if (!pairReady || !propertyAId || !propertyBId) {
      setVerdict(null);
      setLoadError(null);
      return;
    }
    setLoadError(null);
    startLoad(async () => {
      const r = await getComparison(propertyAId, propertyBId);
      if (!r.ok) {
        setVerdict(null);
        setLoadError(r.error);
        return;
      }
      if (!r.comparison) {
        setVerdict(null);
        return;
      }
      setVerdict({
        text: r.comparison.aiSummary,
        createdAt: r.comparison.createdAt,
      });
    });
  }, [pairReady, propertyAId, propertyBId]);

  useEffect(() => {
    loadVerdict();
  }, [loadVerdict]);

  function onGenerate() {
    if (!pairReady || !propertyAId || !propertyBId) return;
    setGenError(null);
    startGen(async () => {
      const r = await generateComparisonVerdict(propertyAId, propertyBId);
      if (!r.ok) {
        setGenError(r.error);
        return;
      }
      setVerdict({ text: r.verdict, createdAt: r.createdAt });
    });
  }

  const priceWin = pairReady ? betterLower(propA!.price, propB!.price) : null;
  const bedWin = pairReady ? betterHigher(propA!.bedrooms, propB!.bedrooms) : null;
  const bathWin = pairReady
    ? betterHigher(propA!.bathrooms, propB!.bathrooms)
    : null;
  const parkWin = pairReady ? betterHigher(propA!.parking, propB!.parking) : null;

  const optionsA = properties.filter((p) => p.id !== propertyBId);
  const optionsB = properties.filter((p) => p.id !== propertyAId);

  return (
    <div className="space-y-8">
      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base text-[#111827]">
            <GitCompareArrows className="h-5 w-5 text-[#0D9488]" />
            Select properties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="compare-a" className="text-sm font-medium text-[#111827]">
                Property A
              </label>
              <select
                id="compare-a"
                value={propertyAId}
                onChange={(e) => {
                  setPropertyAId(e.target.value);
                  setVerdict(null);
                }}
                className={selectClassName}
              >
                <option value="">Select property A</option>
                {optionsA.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.address}, {p.suburb}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="compare-b" className="text-sm font-medium text-[#111827]">
                Property B
              </label>
              <select
                id="compare-b"
                value={propertyBId}
                onChange={(e) => {
                  setPropertyBId(e.target.value);
                  setVerdict(null);
                }}
                className={selectClassName}
              >
                <option value="">Select property B</option>
                {optionsB.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.address}, {p.suburb}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {propertyAId && propertyBId && propertyAId === propertyBId ? (
            <p className="mt-4 text-sm text-amber-800" role="alert">
              Choose two different properties to compare.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {pairReady && propA && propB ? (
        <>
          <Card className="border-[#E5E7EB] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-[#111827]">Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <div className="hidden md:block">
                <div className="grid grid-cols-[minmax(8rem,1fr)_1fr_1fr] gap-x-4 gap-y-6 border-b border-[#E5E7EB] pb-6 text-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]" />
                  <div className="text-center text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    Property A
                  </div>
                  <div className="text-center text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    Property B
                  </div>

                  <RowLabel>Photo</RowLabel>
                  <PhotoCell property={propA} />
                  <PhotoCell property={propB} />

                  <RowLabel>Address</RowLabel>
                  <Cell>
                    <span className="font-medium text-[#111827]">
                      {propA.address}
                    </span>
                    <span className="block text-[#6B7280]">{propA.suburb}</span>
                  </Cell>
                  <Cell>
                    <span className="font-medium text-[#111827]">
                      {propB.address}
                    </span>
                    <span className="block text-[#6B7280]">{propB.suburb}</span>
                  </Cell>

                  <RowLabel>Price</RowLabel>
                  <Cell className={priceWin === "a" ? highlight : undefined}>
                    {formatAud(propA.price)}
                  </Cell>
                  <Cell className={priceWin === "b" ? highlight : undefined}>
                    {formatAud(propB.price)}
                  </Cell>

                  <RowLabel>Type</RowLabel>
                  <Cell>{propA.propertyType ?? "—"}</Cell>
                  <Cell>{propB.propertyType ?? "—"}</Cell>

                  <RowLabel>Bedrooms</RowLabel>
                  <Cell className={bedWin === "a" ? highlight : undefined}>
                    {propA.bedrooms ?? "—"}
                  </Cell>
                  <Cell className={bedWin === "b" ? highlight : undefined}>
                    {propB.bedrooms ?? "—"}
                  </Cell>

                  <RowLabel>Bathrooms</RowLabel>
                  <Cell className={bathWin === "a" ? highlight : undefined}>
                    {propA.bathrooms ?? "—"}
                  </Cell>
                  <Cell className={bathWin === "b" ? highlight : undefined}>
                    {propB.bathrooms ?? "—"}
                  </Cell>

                  <RowLabel>Parking</RowLabel>
                  <Cell className={parkWin === "a" ? highlight : undefined}>
                    {propA.parking ?? "—"}
                  </Cell>
                  <Cell className={parkWin === "b" ? highlight : undefined}>
                    {propB.parking ?? "—"}
                  </Cell>

                  <RowLabel>Status</RowLabel>
                  <Cell>
                    <Badge variant={statusBadgeVariant(propA.status)}>
                      {formatStatusLabel(propA.status)}
                    </Badge>
                  </Cell>
                  <Cell>
                    <Badge variant={statusBadgeVariant(propB.status)}>
                      {formatStatusLabel(propB.status)}
                    </Badge>
                  </Cell>

                  <RowLabel>Notes</RowLabel>
                  <NotesCell notes={propA.notes} />
                  <NotesCell notes={propB.notes} />

                  <RowLabel>Listing</RowLabel>
                  <Cell>
                    {propA.listingUrl ? (
                      <a
                        href={propA.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-[#0D9488] hover:underline"
                      >
                        Open
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </Cell>
                  <Cell>
                    {propB.listingUrl ? (
                      <a
                        href={propB.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-[#0D9488] hover:underline"
                      >
                        Open
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </Cell>

                  <RowLabel>Agent</RowLabel>
                  <Cell>
                    <AgentBlock
                      name={propA.agentName}
                      agency={propA.agencyName}
                    />
                  </Cell>
                  <Cell>
                    <AgentBlock
                      name={propB.agentName}
                      agency={propB.agencyName}
                    />
                  </Cell>
                </div>
              </div>

              <div className="space-y-6 md:hidden">
                <MobileBlock
                  title="Photo"
                  a={<ComparePropertyPhotos property={propA} />}
                  b={<ComparePropertyPhotos property={propB} />}
                />
                <MobileBlock
                  title="Address"
                  a={
                    <>
                      <span className="font-medium">{propA.address}</span>
                      <span className="block text-[#6B7280]">{propA.suburb}</span>
                    </>
                  }
                  b={
                    <>
                      <span className="font-medium">{propB.address}</span>
                      <span className="block text-[#6B7280]">{propB.suburb}</span>
                    </>
                  }
                />
                <MobileBlock
                  title="Price"
                  a={<span className={priceWin === "a" ? highlight : ""}>{formatAud(propA.price)}</span>}
                  b={<span className={priceWin === "b" ? highlight : ""}>{formatAud(propB.price)}</span>}
                />
                <MobileBlock title="Type" a={propA.propertyType ?? "—"} b={propB.propertyType ?? "—"} />
                <MobileBlock
                  title="Bedrooms"
                  a={<span className={bedWin === "a" ? highlight : ""}>{propA.bedrooms ?? "—"}</span>}
                  b={<span className={bedWin === "b" ? highlight : ""}>{propB.bedrooms ?? "—"}</span>}
                />
                <MobileBlock
                  title="Bathrooms"
                  a={<span className={bathWin === "a" ? highlight : ""}>{propA.bathrooms ?? "—"}</span>}
                  b={<span className={bathWin === "b" ? highlight : ""}>{propB.bathrooms ?? "—"}</span>}
                />
                <MobileBlock
                  title="Parking"
                  a={<span className={parkWin === "a" ? highlight : ""}>{propA.parking ?? "—"}</span>}
                  b={<span className={parkWin === "b" ? highlight : ""}>{propB.parking ?? "—"}</span>}
                />
                <MobileBlock
                  title="Status"
                  a={
                    <Badge variant={statusBadgeVariant(propA.status)}>
                      {formatStatusLabel(propA.status)}
                    </Badge>
                  }
                  b={
                    <Badge variant={statusBadgeVariant(propB.status)}>
                      {formatStatusLabel(propB.status)}
                    </Badge>
                  }
                />
                <MobileBlock
                  title="Notes"
                  a={<NotesBlock notes={propA.notes} />}
                  b={<NotesBlock notes={propB.notes} />}
                />
                <MobileBlock
                  title="Listing"
                  a={
                    propA.listingUrl ? (
                      <a href={propA.listingUrl} target="_blank" rel="noopener noreferrer" className="text-[#0D9488] hover:underline">
                        Open listing
                      </a>
                    ) : (
                      "—"
                    )
                  }
                  b={
                    propB.listingUrl ? (
                      <a href={propB.listingUrl} target="_blank" rel="noopener noreferrer" className="text-[#0D9488] hover:underline">
                        Open listing
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <MobileBlock
                  title="Agent"
                  a={<AgentBlock name={propA.agentName} agency={propA.agencyName} />}
                  b={<AgentBlock name={propB.agentName} agency={propB.agencyName} />}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB] bg-white shadow-sm">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base text-[#111827]">AI Verdict</CardTitle>
              <Button
                type="button"
                onClick={onGenerate}
                disabled={pendingGen || pendingLoad}
                className="w-full shrink-0 bg-[#0D9488] text-white hover:bg-[#0D9488]/90 sm:w-auto"
              >
                {pendingGen ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : verdict ? (
                  "Regenerate verdict"
                ) : (
                  "Generate verdict"
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadError ? (
                <p className="text-sm text-red-600" role="alert">
                  {loadError}
                </p>
              ) : null}
              {genError ? (
                <p className="text-sm text-red-600" role="alert">
                  {genError}
                </p>
              ) : null}
              {pendingLoad && !verdict ? (
                <p className="text-sm text-[#6B7280]">Loading saved verdict…</p>
              ) : null}
              {verdict ? (
                <>
                  <p className="text-xs text-[#6B7280]">
                    Generated{" "}
                    {new Date(verdict.createdAt).toLocaleString("en-AU", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4">
                    <VerdictMarkdown text={verdict.text} />
                  </div>
                </>
              ) : !pendingLoad ? (
                <p className="text-sm text-[#6B7280]">
                  No verdict yet. Click Generate to compare these two with our AI.
                </p>
              ) : null}
            </CardContent>
          </Card>
          {propertyAId && propertyBId && (
            <button
              type="button"
              onClick={() => {
                const addrA = properties.find((p) => p.id === propertyAId)?.address ?? "Property A";
                const addrB = properties.find((p) => p.id === propertyBId)?.address ?? "Property B";
                openAigent(`Help me decide between ${addrA} and ${addrB}. Which is the better buy and why?`);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#0D9488]/20 bg-[#0D9488]/5 px-4 py-3 text-sm font-semibold text-[#0D9488] transition-colors hover:bg-[#0D9488]/10"
            >
              <Sparkles className="h-4 w-4" />
              Ask Buyers Aigent to help decide →
            </button>
          )}
        </>
      ) : properties.length < 2 ? (
        <Card className="border-[#E5E7EB] bg-white shadow-sm">
          <CardContent className="py-8 text-center text-sm text-[#6B7280]">
            Add at least two properties to use the comparison tool.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function RowLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
      {children}
    </div>
  );
}

function Cell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-center text-[#111827]", className)}>{children}</div>
  );
}

function PhotoCell({ property }: { property: Property }) {
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[220px]">
        <ComparePropertyPhotos property={property} />
      </div>
    </div>
  );
}

function NotesCell({ notes }: { notes: string | null }) {
  const lines = notesToBullets(notes);
  return (
    <Cell>
      {lines.length ? (
        <ul className="mx-auto max-w-xs space-y-1 text-left text-sm">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : (
        "—"
      )}
    </Cell>
  );
}

function NotesBlock({ notes }: { notes: string | null }) {
  const lines = notesToBullets(notes);
  if (!lines.length) return "—";
  return (
    <ul className="space-y-1 text-sm">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}

function AgentBlock({
  name,
  agency,
}: {
  name: string | null;
  agency: string | null;
}) {
  const n = name?.trim();
  const a = agency?.trim();
  if (!n && !a) return <>—</>;
  return (
    <div className="text-sm">
      {n ? <span className="font-medium text-[#111827]">{n}</span> : null}
      {n && a ? <br /> : null}
      {a ? <span className="text-[#6B7280]">{a}</span> : null}
    </div>
  );
}

function MobileBlock({
  title,
  a,
  b,
}: {
  title: string;
  a: ReactNode;
  b: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-[#0D9488]">Property A</p>
          <div className="text-sm text-[#111827]">{a}</div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-[#0D9488]">Property B</p>
          <div className="text-sm text-[#111827]">{b}</div>
        </div>
      </div>
    </div>
  );
}
