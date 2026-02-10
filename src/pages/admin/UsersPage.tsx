import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Search, MoreHorizontal } from "lucide-react";

const users = [
  { id: 1, name: "John Smith", email: "john@example.com", role: "patient", status: "active" },
  { id: 2, name: "Dr. Sarah Wilson", email: "sarah@clinic.com", role: "doctor", status: "active" },
  { id: 3, name: "MediCare Pharmacy", email: "medicare@pharmacy.com", role: "pharmacist", status: "pending" },
  { id: 4, name: "Emma Johnson", email: "emma@example.com", role: "patient", status: "suspended" },
];

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-500",
  pending: "bg-yellow-500/20 text-yellow-500",
  suspended: "bg-red-500/20 text-red-500",
};

const roleColors: Record<string, string> = {
  patient: "bg-blue-500/20 text-blue-500",
  doctor: "bg-purple-500/20 text-purple-500",
  pharmacist: "bg-orange-500/20 text-orange-500",
  admin: "bg-primary/20 text-primary",
};

export default function UsersPage() {
  return (
    <DashboardLayout requiredRole="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Users</h1>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search users..." className="pl-9" />
          </div>
        </div>

        <div className="space-y-4">
          {users.map((user) => (
            <GlassCard key={user.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{user.name}</h3>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={roleColors[user.role]}>{user.role}</Badge>
                  <Badge className={statusColors[user.status]}>{user.status}</Badge>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
