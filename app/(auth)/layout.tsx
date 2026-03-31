export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0F172A] px-4 py-12">
      <div className="mb-8 text-center">
        <p className="text-lg font-semibold tracking-tight text-foreground">
          PropTrackr
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Property buyer dashboard
        </p>
      </div>
      {children}
    </div>
  );
}
