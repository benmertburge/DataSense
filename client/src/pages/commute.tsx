import { CommuteManager } from "@/components/commute/commute-manager";

export default function Commute() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <CommuteManager />
      </div>
    </div>
  );
}