import BattleRoom from "@/components/BattleRoom";
import Leaderboard from "@/components/Leaderboard";

export default function Game() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#05030d] via-[#0b041a] to-[#140426] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10">
        <BattleRoom />
        <Leaderboard />
      </div>
    </div>
  );
}
