export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </div>
      <footer className="border-t border-border py-6 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by Design Force Analytics
        </p>
      </footer>
    </div>
  );
}
