import { AppSidebar } from '@/components/layout/AppSidebar';
import { HistoryProvider } from '@/contexts/HistoryContext';
import { SidebarProvider } from "@/components/ui/sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen>
      <HistoryProvider>
        <div className="flex min-h-screen">
          <AppSidebar />
          <main className="flex-1 flex flex-col overflow-hidden bg-background">
            {children}
          </main>
        </div>
      </HistoryProvider>
    </SidebarProvider>
  );
}
