import { Sidebar } from "@/app/_components/ui/sidebar";
import { AgentPanel } from "@/app/_components/agent/agent-panel";
import { ComposePanel } from "@/app/_components/agent/compose-panel";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-base flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <AgentPanel />
      <ComposePanel />
    </div>
  );
}
