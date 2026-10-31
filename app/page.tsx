import { Suspense } from "react";
import { checkNeonConnectionAction } from "@/app/actions/database";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

async function NeonTelemetryPanel() {
  const { data, error } = await checkNeonConnectionAction({ source: "home" });

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Delta-MRV
          </h1>
          <p className="text-sm text-neutral-400">
            Lakebase Postgres on Neon — Live Telemetry &amp; Verification Node
          </p>
        </div>
        <Badge
          className={
            data?.connected
              ? "bg-[#D7F6B8] text-[#101A18] hover:bg-[#D7F6B8]/90 font-mono tabular-nums"
              : "bg-red-500/20 text-red-300 font-mono tabular-nums"
          }
        >
          {data?.connected ? "VERIFIED ONLINE" : "DISCONNECTED"}
        </Badge>
      </div>

      <Card className="bg-[#172623] border-white/10 text-neutral-100">
        <CardHeader>
          <CardTitle className="text-lg text-white">
            Neon Database Connection
          </CardTitle>
          <CardDescription className="text-neutral-400">
            Wired via <code className="font-mono">@neondatabase/serverless</code>{" "}
            and Drizzle ORM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 font-mono">
              {error}
            </div>
          ) : data ? (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
              <div className="rounded-lg bg-[#101A18]/60 p-3 border border-white/5">
                <dt className="text-neutral-400 text-xs uppercase tracking-wider">
                  Neon Branch
                </dt>
                <dd className="mt-1 font-mono tabular-nums text-[#D7F6B8]">
                  {data.branch}
                </dd>
              </div>
              <div className="rounded-lg bg-[#101A18]/60 p-3 border border-white/5">
                <dt className="text-neutral-400 text-xs uppercase tracking-wider">
                  Query Latency
                </dt>
                <dd className="mt-1 font-mono tabular-nums text-[#D7F6B8]">
                  {data.latencyMs} ms
                </dd>
              </div>
              <div className="rounded-lg bg-[#101A18]/60 p-3 border border-white/5">
                <dt className="text-neutral-400 text-xs uppercase tracking-wider">
                  Database / Role
                </dt>
                <dd className="mt-1 font-mono tabular-nums text-neutral-200">
                  {data.database} ({data.user})
                </dd>
              </div>
              <div className="rounded-lg bg-[#101A18]/60 p-3 border border-white/5">
                <dt className="text-neutral-400 text-xs uppercase tracking-wider">
                  Connection Mode
                </dt>
                <dd className="mt-1 font-mono tabular-nums text-neutral-200">
                  {data.pooledConnection ? "Pooled (-pooler)" : "Direct"} /{" "}
                  {data.directUrlConfigured ? "Direct Ready" : "No Unpooled"}
                </dd>
              </div>
              <div className="rounded-lg bg-[#101A18]/60 p-3 border border-white/5 sm:col-span-2">
                <dt className="text-neutral-400 text-xs uppercase tracking-wider">
                  Engine &amp; Extensions Available
                </dt>
                <dd className="mt-1 font-mono tabular-nums text-neutral-200">
                  {data.pgVersion} — [{data.availableExtensions.join(", ")}]
                </dd>
              </div>
              <div className="rounded-lg bg-[#101A18]/60 p-3 border border-white/5 sm:col-span-2">
                <dt className="text-neutral-400 text-xs uppercase tracking-wider">
                  Server Timestamp
                </dt>
                <dd className="mt-1 font-mono tabular-nums text-neutral-300">
                  {data.serverTime}
                </dd>
              </div>
            </dl>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#101A18] text-neutral-100 flex items-center justify-center p-6">
      <Suspense
        fallback={
          <div className="w-full max-w-2xl space-y-6">
            <Skeleton className="h-12 w-full bg-[#172623]" />
            <Skeleton className="h-64 w-full bg-[#172623]" />
          </div>
        }
      >
        <NeonTelemetryPanel />
      </Suspense>
    </main>
  );
}
