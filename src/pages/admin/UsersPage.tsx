import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { User, Search, Trash2, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  membershipNumber?: string;
  specialty?: string;
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
  const [deleteUser, setDeleteUser] = useState<UserData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, membership_number, specialty');

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
        status: 'active',
        membershipNumber: p.membership_number,
        specialty: p.specialty
      })) || [];

      setUsers(userData);
      setFilteredUsers(userData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setIsDeleting(true);
    try {
      // Call the admin_delete_user RPC
      const { error } = await (supabase.rpc as any)('admin_delete_user', {
        target_user_id: deleteUser.id,
      });

      if (error) throw error;

      toast({
        title: "User deleted",
        description: `${deleteUser.name} has been removed from the system.`,
      });

      setDeleteUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete user. Check RPC is set up.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const filtered = users.filter(u =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.membershipNumber && u.membershipNumber.toLowerCase().includes(searchQuery.toLowerCase()))
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
                      {user.role === 'patient' && user.membershipNumber && (
                        <p className="text-xs text-primary/70 font-medium">Mem: {user.membershipNumber}</p>
                      )}
                      {user.role === 'doctor' && user.specialty && (
                        <p className="text-xs text-secondary/70 font-medium">{user.specialty}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={roleColors[user.role] || "bg-muted text-muted-foreground"}>{user.role}</Badge>
                    <Badge className={statusColors[user.status]}>{user.status}</Badge>
                    {user.role !== 'admin' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteUser(user)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{deleteUser?.name}</strong> ({deleteUser?.email})?
              This action cannot be undone. All their data will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteUser(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
