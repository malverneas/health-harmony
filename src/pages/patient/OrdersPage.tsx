import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, Clock, Loader2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface Order {
  id: string;
  pharmacyName: string;
  itemCount: number;
  status: string;
  deliveryType: string;
  createdAt: Date;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-500",
  preparing: "bg-yellow-500/20 text-yellow-500",
  ready: "bg-green-500/20 text-green-500",
  "out-for-delivery": "bg-blue-500/20 text-blue-500",
  delivered: "bg-muted text-muted-foreground",
  collected: "bg-muted text-muted-foreground",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          delivery_type,
          created_at,
          pharmacy_id,
          prescription_id
        `)
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch pharmacy names
        const pharmacyIds = [...new Set(data.map(o => o.pharmacy_id))];
        const { data: pharmacies } = await supabase
          .from('pharmacies')
          .select('id, name')
          .in('id', pharmacyIds);

        const pharmacyMap = new Map(pharmacies?.map(p => [p.id, p.name]) || []);

        // Fetch prescription item counts
        const prescriptionIds = [...new Set(data.map(o => o.prescription_id))];
        const { data: items } = await supabase
          .from('prescription_items')
          .select('prescription_id')
          .in('prescription_id', prescriptionIds);

        const itemCountMap = items?.reduce((acc, item) => {
          acc[item.prescription_id] = (acc[item.prescription_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

        setOrders(data.map(o => ({
          id: o.id,
          pharmacyName: pharmacyMap.get(o.pharmacy_id) || 'Unknown Pharmacy',
          itemCount: itemCountMap[o.prescription_id] || 0,
          status: o.status,
          deliveryType: o.delivery_type,
          createdAt: new Date(o.created_at)
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

  return (
    <DashboardLayout requiredRole="patient">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Orders</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
            <p className="text-muted-foreground">Your medication orders will appear here</p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <GlassCard key={order.id} className="p-4">
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
                      <h3 className="font-semibold">{order.pharmacyName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {order.itemCount} medication(s) • {order.deliveryType}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(order.createdAt, 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <Badge className={statusColors[order.status] || statusColors.pending}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('-', ' ')}
                  </Badge>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
