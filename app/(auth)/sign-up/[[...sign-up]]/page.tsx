import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        elements: {
          rootBox: "mx-auto",
          card: "bg-card border-border shadow-xl",
        },
        variables: {
          colorPrimary: "#0D9488",
          colorBackground: "#1E293B",
          colorInputBackground: "#0F172A",
          colorText: "#f8fafc",
          colorTextSecondary: "#94a3b8",
        },
      }}
    />
  );
}
