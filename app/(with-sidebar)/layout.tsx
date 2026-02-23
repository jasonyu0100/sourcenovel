import { Sidebar } from "@/components/sidebar";

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-h-screen lg:min-w-0 pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
