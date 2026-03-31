import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        elements: {
          rootBox: "mx-auto",
          card: "bg-white border border-line shadow-card",
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
