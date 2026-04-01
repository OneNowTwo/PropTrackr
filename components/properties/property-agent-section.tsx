"use client";

import Link from "next/link";
import { ChevronRight, Mail, Pencil, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateAgentDetails } from "@/app/actions/properties";
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

export type PropertyAgentSectionProps = {
  propertyId: string;
  agentId: string | null;
  agentName: string | null;
  agencyName: string | null;
  agentPhotoUrl: string | null;
  agentEmail: string | null;
  agentPhone: string | null;
};

export function PropertyAgentSection(props: PropertyAgentSectionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const name = props.agentName?.trim() ?? "";
  const agency = props.agencyName?.trim() ?? "";
  const displayName = name || agency || "Agent";
  const showAgencyBelow = Boolean(name && agency);

  const initial = name
    ? name.charAt(0).toUpperCase()
    : agency
      ? agency.charAt(0).toUpperCase()
      : "?";

  function onSave(formData: FormData) {
    setError(null);
    formData.set("propertyId", props.propertyId);
    startTransition(async () => {
      const r = await updateAgentDetails(formData);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="text-base text-[#111827]">Agent</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB]"
            >
              <Pencil className="h-3.5 w-3.5 text-[#0D9488]" />
              Edit agent details
            </Button>
          </DialogTrigger>
          <DialogContent
            key={`${props.agentName ?? ""}|${props.agencyName ?? ""}|${props.agentPhotoUrl ?? ""}|${props.agentEmail ?? ""}|${props.agentPhone ?? ""}`}
            className="border-[#E5E7EB] bg-white sm:max-w-md"
          >
            <DialogHeader>
              <DialogTitle className="text-[#111827]">Edit agent details</DialogTitle>
            </DialogHeader>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                onSave(new FormData(e.currentTarget));
              }}
            >
              {error ? (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="grid gap-2">
                <label htmlFor="edit-agent-name" className="text-sm font-medium text-[#111827]">
                  Agent name
                </label>
                <Input
                  id="edit-agent-name"
                  name="agentName"
                  defaultValue={props.agentName ?? ""}
                  className="border-[#E5E7EB]"
                  placeholder="Full name"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="edit-agency-name" className="text-sm font-medium text-[#111827]">
                  Agency name
                </label>
                <Input
                  id="edit-agency-name"
                  name="agencyName"
                  defaultValue={props.agencyName ?? ""}
                  className="border-[#E5E7EB]"
                  placeholder="e.g. Ray White"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="edit-agent-photo" className="text-sm font-medium text-[#111827]">
                  Agent photo URL
                </label>
                <Input
                  id="edit-agent-photo"
                  name="agentPhotoUrl"
                  type="url"
                  defaultValue={props.agentPhotoUrl ?? ""}
                  className="border-[#E5E7EB]"
                  placeholder="https://…"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="edit-agent-email" className="text-sm font-medium text-[#111827]">
                  Email
                </label>
                <Input
                  id="edit-agent-email"
                  name="agentEmail"
                  type="email"
                  defaultValue={props.agentEmail ?? ""}
                  className="border-[#E5E7EB]"
                  placeholder="agent@agency.com.au"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="edit-agent-phone" className="text-sm font-medium text-[#111827]">
                  Phone
                </label>
                <Input
                  id="edit-agent-phone"
                  name="agentPhone"
                  type="tel"
                  defaultValue={props.agentPhone ?? ""}
                  className="border-[#E5E7EB]"
                  placeholder="+61 …"
                />
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
      <CardContent className="space-y-4">
        {props.agentId ? (
          <div className="space-y-3">
            <Link
              href={`/agents/${props.agentId}`}
              className="flex flex-wrap items-start gap-4 rounded-lg outline-none ring-offset-2 transition-colors hover:bg-[#F9FAFB] focus-visible:ring-2 focus-visible:ring-[#0D9488] -m-2 p-2"
            >
              {props.agentPhotoUrl?.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={props.agentPhotoUrl.trim()}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-[#E5E7EB]"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-sm font-semibold text-[#6B7280] ring-1 ring-[#E5E7EB]"
                  aria-hidden
                >
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#111827]">{displayName}</p>
                {showAgencyBelow ? (
                  <p className="text-sm text-[#6B7280]">{agency}</p>
                ) : null}
              </div>
            </Link>
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
              {props.agentPhone?.trim() ? (
                <a
                  href={`tel:${props.agentPhone.trim().replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-2 font-medium text-[#0D9488] hover:underline"
                >
                  <Phone className="h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden />
                  {props.agentPhone.trim()}
                </a>
              ) : null}
              {props.agentEmail?.trim() ? (
                <a
                  href={`mailto:${props.agentEmail.trim()}`}
                  className="inline-flex min-w-0 items-center gap-2 break-all font-medium text-[#0D9488] hover:underline"
                >
                  <Mail className="h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden />
                  {props.agentEmail.trim()}
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-4">
            {props.agentPhotoUrl?.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={props.agentPhotoUrl.trim()}
                alt=""
                className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-[#E5E7EB]"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-sm font-semibold text-[#6B7280] ring-1 ring-[#E5E7EB]"
                aria-hidden
              >
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-sm font-bold text-[#111827]">{displayName}</p>
                {showAgencyBelow ? (
                  <p className="text-sm text-[#6B7280]">{agency}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
                {props.agentPhone?.trim() ? (
                  <a
                    href={`tel:${props.agentPhone.trim().replace(/\s+/g, "")}`}
                    className="inline-flex items-center gap-2 font-medium text-[#0D9488] hover:underline"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden />
                    {props.agentPhone.trim()}
                  </a>
                ) : null}
                {props.agentEmail?.trim() ? (
                  <a
                    href={`mailto:${props.agentEmail.trim()}`}
                    className="inline-flex min-w-0 items-center gap-2 break-all font-medium text-[#0D9488] hover:underline"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden />
                    {props.agentEmail.trim()}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        )}
        {props.agentId ? (
          <Link
            href={`/agents/${props.agentId}`}
            className="flex items-center gap-1 border-t border-[#E5E7EB] pt-4 text-sm font-medium text-[#0D9488] hover:underline"
          >
            View full agent profile
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <p className="border-t border-[#E5E7EB] pt-4 text-sm text-[#6B7280]">
            Save agent details on a property to link a profile automatically.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
