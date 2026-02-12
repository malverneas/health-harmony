import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, ChevronRight, Loader2, FileText, Download } from "lucide-react";
import { downloadAsCSV } from "@/utils/exportUtils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Order {
  id: string;
  patientId: string;
  patientName: string;
  deliveryType: 'pickup' | 'delivery';
  deliveryAddress: string | null;
  status: string;
  createdAt: Date;
  prescriptionId: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-500",
  preparing: "bg-orange-500/20 text-orange-500",
  ready: "bg-green-500/20 text-green-500",
  out_for_delivery: "bg-blue-500/20 text-blue-500",
  collected: "bg-muted text-muted-foreground",
  delivered: "bg-muted text-muted-foreground",
};

const nextStatus: Record<string, string> = {
  pending: "preparing",
  preparing: "ready",
};

export default function PharmacyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchOrders = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: pharmacyData } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!pharmacyData) return;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          patient_id,
          delivery_type,
          delivery_address,
          status,
          created_at,
          prescription_id
        `)
        .eq('pharmacy_id', pharmacyData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const patientIds = [...new Set(data.map(o => o.patient_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', patientIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        setOrders(data.map(o => ({
          id: o.id,
          patientId: o.patient_id,
          patientName: profileMap.get(o.patient_id) || 'Unknown Patient',
          deliveryType: o.delivery_type as 'pickup' | 'delivery',
          deliveryAddress: o.delivery_address,
          status: o.status,
          createdAt: new Date(o.created_at!),
          prescriptionId: o.prescription_id
        })));
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const handleExport = () => {
    const exportData = orders.map(order => ({
      'Order ID': order.id,
      'Patient Name': order.patientName,
      'Type': order.deliveryType,
      'Address': order.deliveryAddress || 'N/A',
      'Status': order.status,
      'Date': format(order.createdAt, 'PPp'),
      'Prescription ID': order.prescriptionId
    }));
    downloadAsCSV(exportData, 'pharmacy_orders');
  };

  const updateOrderStatus = async (orderId: string, currentStatus: string, deliveryType: string) => {
    let newStatus = nextStatus[currentStatus];

    if (!newStatus) {
      if (currentStatus === 'ready') {
        newStatus = deliveryType === 'delivery' ? 'out_for_delivery' : 'collected';
      } else if (currentStatus === 'out_for_delivery') {
        newStatus = 'delivered';
      } else {
        return;
      }
    }

    setUpdatingId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Order Updated",
        description: `Order marked as ${newStatus.replace(/_/g, ' ')}`,
      });

      fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <DashboardLayout requiredRole="pharmacist">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Orders</h1>
          <Button variant="outline" className="gap-2" onClick={handleExport} disabled={orders.length === 0}>
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No orders found</h3>
            <p className="text-muted-foreground">Orders from patients will appear here</p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <GlassCard key={order.id} className="p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        {order.deliveryType === "delivery" ? (
                          <MapPin className="w-5 h-5 text-primary" />
                        ) : (
                          <Package className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold">{order.patientName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {order.deliveryType} • {format(order.createdAt, 'PPp')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[order.status] || "bg-muted"}>
                        {order.status.replace(/_/g, " ").charAt(0).toUpperCase() + order.status.slice(1).replace(/_/g, " ")}
                      </Badge>
                      {['pending', 'preparing', 'ready', 'out_for_delivery'].includes(order.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateOrderStatus(order.id, order.status, order.deliveryType)}
                          disabled={updatingId === order.id}
                        >
                          {updatingId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {order.deliveryType === "delivery" && order.deliveryAddress && (
                    <div className="flex items-start gap-2 bg-muted/30 p-3 rounded-lg text-sm">
                      <MapPin className="w-4 h-4 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Delivery Address:</p>
                        <p className="text-muted-foreground">{order.deliveryAddress}</p>
                      </div>
                    </div>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
