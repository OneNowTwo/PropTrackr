"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { acceptInvite } from "@/app/actions/household";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);
    const result = await acceptInvite(token);
    if (result.ok) {
      router.push("/dashboard");
    } else {
      setError(result.error ?? "Failed to accept invite");
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <button
        type="button"
        onClick={handleAccept}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#0D9488]/90 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Join their search
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
