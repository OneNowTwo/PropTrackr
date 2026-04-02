import { Suspense } from "react";

import { SignUpWithPlan } from "@/components/auth/sign-up-with-plan";

function SignUpFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-[#F8F9FA] text-sm text-[#6B7280]">
      Loading sign up…
    </div>
  );
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] py-4">
      <Suspense fallback={<SignUpFallback />}>
        <SignUpWithPlan />
      </Suspense>
    </div>
  );
}
