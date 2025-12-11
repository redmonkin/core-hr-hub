import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, User, Mail, Phone, MapPin, Building2, Calendar, Briefcase, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeDocuments } from "@/components/documents/EmployeeDocuments";

interface EmployeeProfile {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  designation: string;
  hire_date: string;
  date_of_birth: string | null;
  status: string;
  department: { name: string } | null;
}

interface ProfileForm {
  phone: string;
  address: string;
  city: string;
  country: string;
}

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ProfileForm>({
    phone: '',
    address: '',
    city: '',
    country: '',
  });

  // Fetch employee profile linked to current user
  const { data: employee, isLoading } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('employees')
        .select(`
          id,
          employee_code,
          first_name,
          last_name,
          email,
          phone,
          address,
          city,
          country,
          designation,
          hire_date,
          date_of_birth,
          status,
          departments (name)
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      // Transform the data to match our interface
      if (data) {
        return {
          ...data,
          department: data.departments,
        } as EmployeeProfile;
      }
      return null;
    },
    enabled: !!user?.id,
  });

  // Fetch user profile data
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (employee) {
      setFormData({
        phone: employee.phone || '',
        address: employee.address || '',
        city: employee.city || '',
        country: employee.country || '',
      });
    }
  }, [employee]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      if (!employee?.id) throw new Error("No employee profile found");

      const { error } = await supabase
        .from('employees')
        .update({
          phone: data.phone.trim() || null,
          address: data.address.trim() || null,
          city: data.city.trim() || null,
          country: data.country.trim() || null,
        })
        .eq('id', employee.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      setIsEditing(false);
      toast({ title: "Profile updated", description: "Your information has been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateProfileMutation.mutate(formData);
  };

  const getUserInitials = () => {
    if (employee) {
      return `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();
    }
    return user?.email?.slice(0, 2).toUpperCase() || "U";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Profile</h2>
          <p className="text-muted-foreground">View and manage your personal information</p>
        </div>

        {!employee ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No Employee Profile</h3>
              <p className="mt-2 text-muted-foreground">
                Your account is not linked to an employee profile yet. Please contact HR.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Profile Card */}
            <Card className="md:col-span-1">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={userProfile?.avatar_url || undefined} />
                    <AvatarFallback className="text-2xl">{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <h3 className="mt-4 text-xl font-semibold">
                    {employee.first_name} {employee.last_name}
                  </h3>
                  <p className="text-muted-foreground">{employee.designation}</p>
                  <Badge className="mt-2" variant={employee.status === 'active' ? 'default' : 'secondary'}>
                    {employee.status}
                  </Badge>
                  <Separator className="my-4 w-full" />
                  <div className="w-full space-y-3 text-left text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{employee.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>{employee.department?.name || "No Department"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      <span>{employee.employee_code}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Joined {formatDate(employee.hire_date)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Details Card */}
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your contact details</CardDescription>
                </div>
                {!isEditing ? (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                      setIsEditing(false);
                      setFormData({
                        phone: employee.phone || '',
                        address: employee.address || '',
                        city: employee.city || '',
                        country: employee.country || '',
                      });
                    }}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={updateProfileMutation.isPending}>
                      {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input value={employee.first_name} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input value={employee.last_name} disabled />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={employee.email} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input 
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input 
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="Enter your address"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input 
                      value={formData.city}
                      onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="Enter city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input 
                      value={formData.country}
                      onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="Enter country"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input value={formatDate(employee.date_of_birth)} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Input value={employee.department?.name || "Not Assigned"} disabled />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents Section */}
            <div className="md:col-span-3">
              <EmployeeDocuments employeeId={employee.id} />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Profile;
