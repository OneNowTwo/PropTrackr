"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { InferSelectModel } from "drizzle-orm";

import { updateAgent } from "@/app/actions/agents";
import { agents } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type AgentRow = InferSelectModel<typeof agents>;

export function EditAgentDialog({ agent }: { agent: AgentRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    formData.set("agentId", agent.id);
    startTransition(async () => {
      const r = await updateAgent(formData);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB]"
        >
          <Pencil className="h-3.5 w-3.5 text-[#0D9488]" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent
        key={`${agent.id}|${String(agent.updatedAt)}`}
        className="border-[#E5E7EB] bg-white sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-[#111827]">Edit agent</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(new FormData(e.currentTarget));
          }}
        >
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <div className="grid gap-2">
            <label htmlFor="edit-agent-name" className="text-sm font-medium text-[#111827]">
              Name
            </label>
            <Input
              id="edit-agent-name"
              name="name"
              required
              defaultValue={agent.name}
              className="border-[#E5E7EB]"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="edit-agent-agency" className="text-sm font-medium text-[#111827]">
              Agency
            </label>
            <Input
              id="edit-agent-agency"
              name="agencyName"
              defaultValue={agent.agencyName ?? ""}
              className="border-[#E5E7EB]"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="edit-agent-photo" className="text-sm font-medium text-[#111827]">
              Photo URL
            </label>
            <Input
              id="edit-agent-photo"
              name="photoUrl"
              type="url"
              defaultValue={agent.photoUrl ?? ""}
              className="border-[#E5E7EB]"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="edit-agent-email" className="text-sm font-medium text-[#111827]">
              Email
            </label>
            <Input
              id="edit-agent-email"
              name="email"
              type="email"
              defaultValue={agent.email ?? ""}
              className="border-[#E5E7EB]"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="edit-agent-phone" className="text-sm font-medium text-[#111827]">
              Phone
            </label>
            <Input
              id="edit-agent-phone"
              name="phone"
              type="tel"
              defaultValue={agent.phone ?? ""}
              className="border-[#E5E7EB]"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="edit-agent-notes" className="text-sm font-medium text-[#111827]">
              Notes
            </label>
            <Input
              id="edit-agent-notes"
              name="notes"
              defaultValue={agent.notes ?? ""}
              className="border-[#E5E7EB]"
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
  );
}
