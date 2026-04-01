"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createAgent } from "@/app/actions/agents";
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

export function AddAgentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await createAgent(formData);
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
          className="gap-2 bg-[#0D9488] font-medium text-white shadow-sm hover:bg-[#0D9488]/90"
        >
          <Plus className="h-4 w-4" />
          Add agent
        </Button>
      </DialogTrigger>
      <DialogContent className="border-[#E5E7EB] bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#111827]">Add agent</DialogTitle>
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
            <label htmlFor="add-agent-name" className="text-sm font-medium text-[#111827]">
              Name
            </label>
            <Input
              id="add-agent-name"
              name="name"
              required
              className="border-[#E5E7EB]"
              placeholder="Full name"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="add-agent-agency" className="text-sm font-medium text-[#111827]">
              Agency
            </label>
            <Input
              id="add-agent-agency"
              name="agencyName"
              className="border-[#E5E7EB]"
              placeholder="e.g. Ray White"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="add-agent-photo" className="text-sm font-medium text-[#111827]">
              Photo URL
            </label>
            <Input
              id="add-agent-photo"
              name="photoUrl"
              type="url"
              className="border-[#E5E7EB]"
              placeholder="https://…"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="add-agent-email" className="text-sm font-medium text-[#111827]">
              Email
            </label>
            <Input
              id="add-agent-email"
              name="email"
              type="email"
              className="border-[#E5E7EB]"
              placeholder="agent@agency.com.au"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="add-agent-phone" className="text-sm font-medium text-[#111827]">
              Phone
            </label>
            <Input
              id="add-agent-phone"
              name="phone"
              type="tel"
              className="border-[#E5E7EB]"
              placeholder="+61 …"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="add-agent-notes" className="text-sm font-medium text-[#111827]">
              Notes
            </label>
            <Input
              id="add-agent-notes"
              name="notes"
              className="border-[#E5E7EB]"
              placeholder="Optional"
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending}
              className="bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
            >
              {pending ? "Saving…" : "Save agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
