"use client";

import {
  Building2,
  FileText,
  Layers,
  Plus,
  ScrollText,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createDocument, deleteDocument } from "@/app/actions/property-documents";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DocumentRow } from "@/lib/db/queries";
import { DOCUMENT_TYPE_OPTIONS } from "@/lib/property-detail-constants";
import { cn } from "@/lib/utils";

const selectClassName = cn(
  "flex h-9 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/30",
);

function DocIcon({ type }: { type: string | null }) {
  const t = type ?? "Other";
  const cls = "h-5 w-5 shrink-0 text-[#0D9488]";
  switch (t) {
    case "Contract":
      return <ScrollText className={cls} />;
    case "Pest Report":
    case "Building Report":
      return <Building2 className={cls} />;
    case "Strata Report":
      return <Layers className={cls} />;
    case "Floor Plan":
      return <FileText className={cls} />;
    default:
      return <FileText className={cls} />;
  }
}

type Props = {
  propertyId: string;
  documents: DocumentRow[];
};

export function PropertyDocumentsSection({ propertyId, documents }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function onCreate(formData: FormData) {
    setError(null);
    formData.set("propertyId", propertyId);
    startTransition(async () => {
      const r = await createDocument(formData);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      refresh();
    });
  }

  function onDelete(id: string) {
    if (!window.confirm("Remove this document link?")) return;
    startTransition(async () => {
      await deleteDocument(id);
      refresh();
    });
  }

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-4">
        <CardTitle className="text-base font-semibold text-[#111827]">
          Documents
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              size="sm"
              className="gap-1 bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
            >
              <Plus className="h-4 w-4" />
              Add document
            </Button>
          </DialogTrigger>
          <DialogContent className="border-[#E5E7EB] bg-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#111827]">Add document link</DialogTitle>
            </DialogHeader>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                onCreate(new FormData(e.currentTarget));
              }}
            >
              {error ? (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="grid gap-2">
                <label htmlFor="doc-name" className="text-sm font-medium text-[#111827]">
                  Name
                </label>
                <Input
                  id="doc-name"
                  name="fileName"
                  required
                  className="border-[#E5E7EB]"
                  placeholder="e.g. Contract of sale"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="doc-url" className="text-sm font-medium text-[#111827]">
                  URL
                </label>
                <Input
                  id="doc-url"
                  name="fileUrl"
                  type="url"
                  required
                  className="border-[#E5E7EB]"
                  placeholder="https://…"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="doc-type" className="text-sm font-medium text-[#111827]">
                  Type
                </label>
                <select
                  id="doc-type"
                  name="fileType"
                  required
                  defaultValue="Other"
                  className={selectClassName}
                >
                  {DOCUMENT_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={pending}
                  className="bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
                >
                  {pending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No documents linked yet.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3"
              >
                <DocIcon type={doc.fileType} />
                <div className="min-w-0 flex-1">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#0D9488] hover:underline"
                  >
                    {doc.fileName}
                  </a>
                  {doc.fileType ? (
                    <p className="text-xs text-[#6B7280]">{doc.fileType}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={pending}
                  onClick={() => onDelete(doc.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only sm:ml-1">Delete</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
