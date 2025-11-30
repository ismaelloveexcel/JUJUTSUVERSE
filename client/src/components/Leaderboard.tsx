import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Leader {
  id: number;
  username: string;
  wins: number;
  losses: number;
}

export default function Leaderboard() {
  const { data: leaders, isLoading, error } = useQuery<Leader[]>({
    queryKey: ["leaders"],
    queryFn: () =>
      fetch("/api/leaderboard", { credentials: "include" }).then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load leaderboard");
        }
        return res.json();
      }),
  });

  return (
    <Card className="border border-white/10 bg-black/70 p-6 text-white">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Top Sorcerers
          </p>
          <h2 className="text-2xl font-orbitron">Domain Leaderboard</h2>
        </div>
        <p className="text-sm text-white/60">
          Wins recorded in the past deployment
        </p>
      </div>

      {isLoading && <LeaderboardSkeleton />}

      {!isLoading && error && (
        <p className="mt-6 text-sm text-red-300">
          Failed to load leaderboard. Try again later.
        </p>
      )}

      {!isLoading && leaders && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            {leaders.map((leader, index) => (
              <div
                key={leader.id}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                    Rank {index + 1}
                  </p>
                  <p className="text-lg font-orbitron">{leader.username}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-emerald-300">
                    {leader.wins} wins
                  </p>
                  <p className="text-xs text-white/60">{leader.losses} losses</p>
                </div>
              </div>
            ))}
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaders || []}>
                <XAxis
                  dataKey="username"
                  stroke="#a1a1aa"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#a1a1aa"
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f0f1f",
                    borderRadius: "0.75rem",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                  }}
                />
                <Bar dataKey="wins" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl bg-white/10" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl bg-white/10" />
    </div>
  );
}
