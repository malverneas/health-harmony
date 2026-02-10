import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { UserRole } from "@/types";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  requiredRole?: UserRole;
}

export function DashboardLayout({ children, title, requiredRole }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero-gradient">
        <div className="animate-pulse-glow p-8 rounded-2xl glass-card">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={`/${user?.role}`} replace />;
  }

  return (
    <div className="min-h-screen bg-hero-gradient">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:ml-72 min-h-screen flex flex-col">
        <Header 
          onMenuClick={() => setSidebarOpen(true)} 
          title={title}
        />
        
        <main className="flex-1 p-4 lg:p-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
