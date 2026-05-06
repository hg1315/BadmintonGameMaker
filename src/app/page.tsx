import { Suspense } from "react";
import { BadmintonApp } from "./BadmintonApp";

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-zinc-950 p-6 text-white shadow-xl">
            <div className="h-4 w-40 rounded-full bg-zinc-800" />
            <div className="mt-4 h-10 w-3/4 rounded-2xl bg-zinc-800" />
            <div className="mt-4 h-4 w-full max-w-3xl rounded-full bg-zinc-800" />
            <div className="mt-3 h-4 w-2/3 max-w-2xl rounded-full bg-zinc-800" />
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="h-6 w-40 rounded-full bg-zinc-100" />
              <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                로딩 중…
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-12 rounded-2xl bg-zinc-100" />
              ))}
            </div>
          </div>
        </main>
      }
    >
      <BadmintonApp />
    </Suspense>
  );
}
