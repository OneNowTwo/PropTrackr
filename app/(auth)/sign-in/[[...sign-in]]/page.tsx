import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        elements: {
          rootBox: "mx-auto",
          card: "bg-white border border-[#E5E7EB] shadow-sm rounded-xl",
        },
        variables: {
          colorPrimary: "#0D9488",
          colorBackground: "#ffffff",
          colorInputBackground: "#F9FAFB",
          colorText: "#111827",
          colorTextSecondary: "#6B7280",
        },
      }}
    />
  );
}
