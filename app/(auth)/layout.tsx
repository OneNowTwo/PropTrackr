export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 text-center">
        <p className="text-lg font-semibold tracking-tight text-[#111827]">
          PropTrackr
        </p>
        <p className="mt-1 text-sm text-[#6B7280]">
          Property buyer dashboard
        </p>
      </div>
      {children}
    </div>
  );
}
