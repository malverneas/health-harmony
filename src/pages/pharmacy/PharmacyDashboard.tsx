import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MobileNav } from "@/components/layout/MobileNav";
import { GlassCard } from "@/components/layout/GlassCard";
import { FileText, Truck, Package, CheckCircle2, XCircle, ChevronRight, Pill, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { downloadAsCSV } from "@/utils/exportUtils";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface PharmacyPrescription {
  id: string;
  patientName: string;
  doctorName: string;
  medications: number;
  time: string;
  status: string;
}

interface PharmacyOrder {
  id: string;
  patientName: string;
  type: string;
  status: string;
  items: number;
}

export default function PharmacyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [prescriptions, setPrescriptions] = useState<PharmacyPrescription[]>([]);
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [stats, setStats] = useState({ newRx: 0, activeOrders: 0, delivered: 0 });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: pharma } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!pharma) return;

      // 1. Fetch Prescriptions (sent or acknowledged)
      const { data: rxData } = await supabase
        .from('prescriptions')
        .select(`
          id,
          created_at,
          status,
          patient_id,
          doctor_id
        `)
        .eq('pharmacy_id', pharma.id)
        .in('status', ['sent', 'acknowledged'])
        .order('created_at', { ascending: false });

      // 2. Fetch Orders (active ones)
      const { data: orderData } = await supabase
        .from('orders')
        .select(`
          id,
          patient_id,
          delivery_type,
          status,
          created_at
        `)
        .eq('pharmacy_id', pharma.id)
        .in('status', ['pending', 'preparing', 'ready', 'out_for_delivery'])
        .order('created_at', { ascending: false });

      // 3. Fetch Weekly Delivered count
      const { count: deliveredCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('pharmacy_id', pharma.id)
        .in('status', ['delivered', 'collected']);

      setStats(prev => ({
        ...prev,
        newRx: rxData?.length || 0,
        activeOrders: orderData?.length || 0,
        delivered: deliveredCount || 0
      }));

      // Enrich Prescriptions
      if (rxData && rxData.length > 0) {
        const userIds = [...new Set([...rxData.map(r => r.patient_id), ...rxData.map(r => r.doctor_id)])];
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        // Get medication counts
        const { data: items } = await supabase.from('prescription_items').select('prescription_id').in('prescription_id', rxData.map(r => r.id));
        const countMap = new Map<string, number>();
        items?.forEach(i => countMap.set(i.prescription_id, (countMap.get(i.prescription_id) || 0) + 1));

        setPrescriptions(rxData.map(r => ({
          id: r.id,
          patientName: profileMap.get(r.patient_id) || 'Unknown Patient',
          doctorName: profileMap.get(r.doctor_id) || 'Unknown Doctor',
          medications: countMap.get(r.id) || 0,
          time: formatDistanceToNow(new Date(r.created_at!), { addSuffix: true }),
          status: r.status
        })));
      } else {
        setPrescriptions([]);
      }

      // Enrich Orders
      if (orderData && orderData.length > 0) {
        const patientIds = [...new Set(orderData.map(o => o.patient_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', patientIds);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        setOrders(orderData.map(o => ({
          id: o.id,
          patientName: profileMap.get(o.patient_id) || 'Unknown Patient',
          type: o.delivery_type,
          status: o.status,
          items: 0 // Simplification for dashboard view
        })));
      } else {
        setOrders([]);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (rxId: string, status: string) => {
    try {
      const { error } = await supabase.from('prescriptions').update({ status }).eq('id', rxId);
      if (error) throw error;
      toast({ title: "Updated", description: `Prescription marked as ${status.replace(/_/g, ' ')}` });
      fetchDashboardData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update prescription", variant: "destructive" });
    }
  };

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const { data: pharma } = await supabase.from('pharmacies').select('id').eq('user_id', user.id).single();
      if (pharma) {
        const { data: orders, error } = await supabase
          .from('orders')
          .select(`
            id,
            patient_id,
            delivery_type,
            status,
            created_at
          `)
          .eq('pharmacy_id', pharma.id);

        if (error) throw error;

        if (orders && orders.length > 0) {
          const patientIds = [...new Set(orders.map(o => o.patient_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', patientIds);

          const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

          const exportData = orders.map(o => ({
            'Patient Name': profileMap.get(o.patient_id) || 'Unknown',
            'Order Date': format(new Date(o.created_at!), 'PPP'),
            'Type': o.delivery_type,
            'Status': o.status.replace(/_/g, ' '),
            'Order ID': o.id
          }));

          downloadAsCSV(exportData, 'pharmacy_orders_report');
        }
      }
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout title={`${user?.fullName?.split(' ')[0]}'s Pharmacy`} requiredRole="pharmacist">
      <div className="space-y-4 sm:space-y-6 pb-24 lg:pb-6">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Data
          </Button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3">
          <GlassCard className="p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-primary">{stats.newRx}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">New Rx</p>
          </GlassCard>
          <GlassCard className="p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-secondary">{stats.activeOrders}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Orders</p>
          </GlassCard>
          <GlassCard className="p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-success">{stats.delivered}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Delivered</p>
          </GlassCard>
        </div>

        {/* Incoming Prescriptions */}
        <GlassCard className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              New Prescriptions
            </h3>
            <Button variant="ghost" size="sm" className="text-primary text-xs sm:text-sm" onClick={() => navigate('/pharmacy/prescriptions')}>
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : prescriptions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No new prescriptions</p>
            ) : (
              prescriptions.map((rx) => (
                <div key={rx.id} className="p-3 sm:p-4 rounded-xl bg-muted/30 border-l-4 border-primary">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{rx.patientName}</p>
                      <p className="text-sm text-muted-foreground">{rx.doctorName}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{rx.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {rx.medications} medication{rx.medications > 1 ? "s" : ""}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 sm:flex-none bg-success hover:bg-success/90" onClick={() => handleUpdateStatus(rx.id, 'in_stock')}>
                      <CheckCircle2 className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">In Stock</span>
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => handleUpdateStatus(rx.id, 'out_of_stock')}>
                      <XCircle className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Unavailable</span>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <GlassCard hover className="p-4 cursor-pointer" onClick={() => navigate('/pharmacy/orders')}>
            <div className="p-2.5 sm:p-3 rounded-xl bg-secondary/10 w-fit mb-3">
              <Package className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base">Active Orders</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stats.activeOrders} to process</p>
          </GlassCard>

          <GlassCard hover className="p-4 cursor-pointer" onClick={() => navigate('/pharmacy/inventory')}>
            <div className="p-2.5 sm:p-3 rounded-xl bg-success/10 w-fit mb-3">
              <Pill className="w-5 h-5 text-success" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base">Inventory</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage stock</p>
          </GlassCard>
        </div>

        {/* Messages Shortcut */}
        <GlassCard hover className="p-4 cursor-pointer" onClick={() => navigate('/pharmacy/messages')}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning/10">
              <MessageSquare className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Messages</h3>
              <p className="text-sm text-muted-foreground">Communicate with doctors & patients</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </GlassCard>
      </div>

      <MobileNav />
    </DashboardLayout>
  );
}
