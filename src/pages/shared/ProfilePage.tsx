import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Stethoscope, 
  Hash, 
  Loader2, 
  Save,
  Building
} from "lucide-react";

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
  // Form state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [address, setAddress] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [membershipNumber, setMembershipNumber] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");

  useEffect(() => {
    if (user) {
      fetchProfileData();
    }
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setSpecialty(data.specialty || "");
        setAddress(data.address || "");
        setLicenseNumber(data.license_number || "");
        setMembershipNumber(data.membership_number || "");
        setPharmacyName(data.pharmacy_name || "");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateProfile({
        fullName,
        phone,
        specialty,
        address,
        licenseNumber,
        membershipNumber,
      });

      // If pharmacist, also update pharmacy table
      if (user?.role === 'pharmacist') {
        const { error: pharmacyError } = await supabase
          .from('pharmacies')
          .update({
            name: pharmacyName,
            address: address
          })
          .eq('user_id', user.id);
        
        if (pharmacyError) console.error("Error updating pharmacy record:", pharmacyError);
      }

      toast({
        title: "Profile Updated",
        description: "Your changes have been saved successfully.",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text">My Profile</h1>
          <p className="text-muted-foreground">Manage your personal information and preferences</p>
        </div>

        <GlassCard className="p-8">
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Common Fields */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    value={user?.email || ""}
                    className="pl-10 opacity-70 cursor-not-allowed"
                    disabled
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    placeholder="+263..."
                    required
                  />
                </div>
              </div>

              {/* Role-Specific Fields */}
              {user?.role === 'doctor' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Specialty</label>
                    <div className="relative">
                      <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="pl-10"
                        placeholder="General Medicine"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">License Number</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        className="pl-10"
                        placeholder="MD12345"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Clinic Address / Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="pl-10"
                        placeholder="123 Medical Center, City"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {user?.role === 'pharmacist' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Pharmacy Name</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        value={pharmacyName}
                        onChange={(e) => setPharmacyName(e.target.value)}
                        className="pl-10"
                        placeholder="My Pharmacy"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Pharmacy Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="pl-10"
                        placeholder="123 Pharmacy St, City"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {user?.role === 'patient' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Membership Number</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      value={membershipNumber}
                      onChange={(e) => setMembershipNumber(e.target.value)}
                      className="pl-10"
                      placeholder="MEM-12345"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4">
              <Button type="submit" className="w-full md:w-auto min-w-[150px]" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
