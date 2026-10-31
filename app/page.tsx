import { Suspense } from "react";
import { checkNeonConnectionAction } from "@/app/actions/database";
import { EvidenceUploader } from "@/components/evidence-uploader";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, Activity } from "lucide-react";

async function NeonTelemetryPanel() {
  const { data, error } = await checkNeonConnectionAction({ source: "home" });

  return (
    <Card className="bg-[#172623] border-white/10 text-neutral-100 shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Database className="size-5 text-[#D7F6B8]" />
              Lakebase Postgres Telemetry
            </CardTitle>
            <CardDescription className="text-neutral-400">
              Live Neon connection with PostGIS &amp; pgvector spatial ops
            </CardDescription>
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
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 font-mono">
            {error}
          </div>
        ) : data ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-lg bg-[#101A18]/60 p-3 border border-white/5">
              <dt className="text-neutral-400 uppercase tracking-wider">
                Neon Branch
              </dt>
              <dd className="mt-1 font-mono tabular-nums text-[#D7F6B8]">
                {data.branch}
              </dd>
            </div>
            <div className="rounded-lg bg-[#101A18]/60 p-3 border border-white/5">
              <dt className="text-neutral-400 uppercase tracking-wider">
                Query Latency
              </dt>
              <dd className="mt-1 font-mono tabular-nums text-[#D7F6B8]">
                {data.latencyMs} ms
              </dd>
            </div>
            <div className="rounded-lg bg-[#101A18]/60 p-3 border border-white/5">
              <dt className="text-neutral-400 uppercase tracking-wider">
                Database / Role
              </dt>
              <dd className="mt-1 font-mono tabular-nums text-neutral-200">
                {data.database} ({data.user})
              </dd>
            </div>
            <div className="rounded-lg bg-[#101A18]/60 p-3 border border-white/5">
              <dt className="text-neutral-400 uppercase tracking-wider">
                Active Extensions
              </dt>
              <dd className="mt-1 font-mono tabular-nums text-neutral-200">
                [{data.availableExtensions.join(", ")}]
              </dd>
            </div>
            <div className="rounded-lg bg-[#101A18]/60 p-3 border border-white/5 sm:col-span-2">
              <dt className="text-neutral-400 uppercase tracking-wider">
                PostgreSQL Engine
              </dt>
              <dd className="mt-1 font-mono tabular-nums text-neutral-300">
                {data.pgVersion}
              </dd>
            </div>
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#101A18] text-neutral-100 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="size-6 text-[#D7F6B8]" />
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Delta-MRV
              </h1>
            </div>
            <p className="text-sm text-neutral-400 mt-1">
              Autonomous Measurement, Reporting &amp; Verification for High-Integrity Ecological Restoration
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-[#D7F6B8]/40 text-[#D7F6B8] font-mono text-xs">
              GEMINI 2.5 FLASH ACTIVE
            </Badge>
            <Badge variant="outline" className="border-white/20 text-neutral-300 font-mono text-xs">
              POSTGIS 3.6 + PGVECTOR
            </Badge>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8">
          <EvidenceUploader />

          <Suspense
            fallback={
              <div className="space-y-4">
                <Skeleton className="h-12 w-full bg-[#172623]" />
                <Skeleton className="h-48 w-full bg-[#172623]" />
              </div>
            }
          >
            <NeonTelemetryPanel />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
