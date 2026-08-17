export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md dark:bg-zinc-900">
        {children}
      </div>
    </div>
  );
}
