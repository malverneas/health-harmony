import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Search, MoreHorizontal, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

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
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email');

      if (profileError) throw profileError;

      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (roleError) throw roleError;

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const userData = profiles?.map(p => ({
        id: p.user_id,
        name: p.full_name || 'Unknown',
        email: p.email,
        role: roleMap.get(p.user_id) || 'patient',
        status: 'active' // Status isn't in DB yet, defaulting to active
      })) || [];

      setUsers(userData);
      setFilteredUsers(userData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const filtered = users.filter(u =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  return (
    <DashboardLayout requiredRole="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Manage Users</h1>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <GlassCard className="p-8 text-center">
            {searchQuery ? (
              <p className="text-muted-foreground">No users match your search.</p>
            ) : (
              <div className="space-y-3 flex flex-col items-center">
                <ShieldAlert className="w-10 h-10 text-warning/50" />
                <p className="text-muted-foreground">No users found. Check RLS permissions.</p>
                <Button variant="outline" size="sm" onClick={fetchUsers}>Retry</Button>
              </div>
            )}
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => (
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
                    <Badge className={roleColors[user.role] || "bg-muted text-muted-foreground"}>{user.role}</Badge>
                    <Badge className={statusColors[user.status]}>{user.status}</Badge>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
