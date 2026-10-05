import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkingDaysPicker } from "@/components/employees/WorkingDaysPicker";
import { statusBadgeClass, formatStatus } from "@/lib/statusStyles";
import { Loader2, User, Mail, Phone, MapPin, Building2, Calendar, Briefcase, Save, Shield, FileText, Clock, Wallet, Files, Package, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeDocuments } from "@/components/documents/EmployeeDocuments";
import { LeaveBalanceCard } from "@/components/profile/LeaveBalanceCard";
import { LeaveRequestForm } from "@/components/profile/LeaveRequestForm";
import { LeaveRequestHistory } from "@/components/profile/LeaveRequestHistory";
import { PayslipViewer } from "@/components/profile/PayslipViewer";
import { TaxDocumentsViewer } from "@/components/profile/TaxDocumentsViewer";
import { MyAttendanceHistory } from "@/components/profile/MyAttendanceHistory";
import { MyAssets } from "@/components/profile/MyAssets";
import { MyPerformanceReviews } from "@/components/profile/MyPerformanceReviews";
import { ChangeEmailDialog } from "@/components/profile/ChangeEmailDialog";

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
  gender: string | null;
  status: string;
  department: { name: string } | null;
  working_hours_start: string | null;
  working_hours_end: string | null;
  working_days: number[] | null;
}

interface ProfileForm {
  phone: string;
  address: string;
  city: string;
  country: string;
  date_of_birth: string;
  gender: string;
  working_hours_start: string;
  working_hours_end: string;
  working_days: number[];
}

const ALLOWED_TABS = ["profile", "leaves", "attendance", "assets", "reviews", "payslips", "documents"] as const;

// Read-only and not-yet-editable fields stay legible (no 50% fade).
const READ_ONLY_FIELD = "cursor-default bg-muted/50 text-foreground focus-visible:ring-1";
const EDITABLE_FIELD = "disabled:cursor-default disabled:bg-muted/50 disabled:opacity-100";

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = (searchParams.get("tab") || "").toLowerCase();
  const initialTab = ALLOWED_TABS.includes(tabParam as (typeof ALLOWED_TABS)[number]) ? tabParam : "profile";

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ProfileForm>({
    phone: '',
    address: '',
    city: '',
    country: '',
    date_of_birth: '',
    gender: '',
    working_hours_start: '09:00',
    working_hours_end: '18:00',
    working_days: [1, 2, 3, 4, 5],
  });

  useEffect(() => {
    if (ALLOWED_TABS.includes(tabParam as (typeof ALLOWED_TABS)[number]) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", value);
      return next;
    });
  };

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
          gender,
          status,
          working_hours_start,
          working_hours_end,
          working_days,
          departments:departments!employees_department_id_fkey (name)
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
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
      // Format time from "HH:MM:SS" to "HH:MM" for input
      const formatTimeForInput = (time: string | null) => {
        if (!time) return '';
        return time.slice(0, 5);
      };
      
      setFormData({
        phone: employee.phone || '',
        address: employee.address || '',
        city: employee.city || '',
        country: employee.country || '',
        date_of_birth: employee.date_of_birth || '',
        gender: employee.gender || '',
        working_hours_start: formatTimeForInput(employee.working_hours_start) || '09:00',
        working_hours_end: formatTimeForInput(employee.working_hours_end) || '18:00',
        working_days: employee.working_days || [1, 2, 3, 4, 5],
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
          date_of_birth: data.date_of_birth || null,
          gender: data.gender || null,
          working_hours_start: data.working_hours_start ? `${data.working_hours_start}:00` : null,
          working_hours_end: data.working_hours_end ? `${data.working_hours_end}:00` : null,
          working_days: data.working_days,
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
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">My profile</h1>
          <p className="text-muted-foreground">View and manage your personal information</p>
        </div>

        {!employee ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No employee profile</h3>
              <p className="mt-2 text-muted-foreground">
                Your account is not linked to an employee profile yet. Please contact HR.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="flex w-full justify-start lg:inline-flex lg:w-auto">
              <TabsTrigger value="profile" className="shrink-0 gap-2">
                <User className="h-4 w-4" aria-hidden="true" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="leaves" className="shrink-0 gap-2">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Leaves
              </TabsTrigger>
              <TabsTrigger value="attendance" className="shrink-0 gap-2">
                <Clock className="h-4 w-4" aria-hidden="true" />
                Attendance
              </TabsTrigger>
              <TabsTrigger value="assets" className="shrink-0 gap-2">
                <Package className="h-4 w-4" aria-hidden="true" />
                Assets
              </TabsTrigger>
              <TabsTrigger value="reviews" className="shrink-0 gap-2">
                <Star className="h-4 w-4" aria-hidden="true" />
                Reviews
              </TabsTrigger>
              <TabsTrigger value="payslips" className="shrink-0 gap-2">
                <Wallet className="h-4 w-4" aria-hidden="true" />
                Payslips
              </TabsTrigger>
              <TabsTrigger value="documents" className="shrink-0 gap-2">
                <Files className="h-4 w-4" aria-hidden="true" />
                Documents
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6">
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
                      <Badge className={`mt-2 ${statusBadgeClass(employee.status)}`} variant="outline">
                        {formatStatus(employee.status)}
                      </Badge>
                      <Separator className="my-4 w-full" />
                      <div className="w-full space-y-3 text-left text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="truncate" title={employee.email}>{employee.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{employee.department?.name || "No Department"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{employee.employee_code}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>Joined {formatDate(employee.hire_date)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Details Card */}
                <Card className="md:col-span-2">
                  <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Personal information</CardTitle>
                      <CardDescription>Update your contact details</CardDescription>
                    </div>
                    {!isEditing ? (
                      <Button variant="outline" onClick={() => setIsEditing(true)} className="self-start sm:self-auto">
                        Edit
                      </Button>
                    ) : (
                      <div className="flex shrink-0 gap-2">
                        <Button variant="outline" onClick={() => {
                          setIsEditing(false);
                          const formatTimeForInput = (time: string | null) => {
                            if (!time) return '';
                            return time.slice(0, 5);
                          };
                          setFormData({
                            phone: employee.phone || '',
                            address: employee.address || '',
                            city: employee.city || '',
                            country: employee.country || '',
                            date_of_birth: employee.date_of_birth || '',
                            gender: employee.gender || '',
                            working_hours_start: formatTimeForInput(employee.working_hours_start) || '09:00',
                            working_hours_end: formatTimeForInput(employee.working_hours_end) || '18:00',
                            working_days: employee.working_days || [1, 2, 3, 4, 5],
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
                        <Label htmlFor="profile-first-name">First name</Label>
                        <Input id="profile-first-name" value={employee.first_name} readOnly className={READ_ONLY_FIELD} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="profile-last-name">Last name</Label>
                        <Input id="profile-last-name" value={employee.last_name} readOnly className={READ_ONLY_FIELD} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-email">Email</Label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input id="profile-email" value={employee.email} readOnly className={`min-w-0 flex-1 ${READ_ONLY_FIELD}`} />
                        <ChangeEmailDialog currentEmail={employee.email} />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="profile-phone">Phone</Label>
                        <Input
                          id="profile-phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          disabled={!isEditing}
                          className={EDITABLE_FIELD}
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="profile-department">Department</Label>
                        <Input id="profile-department" value={employee.department?.name || "Not assigned"} readOnly className={READ_ONLY_FIELD} aria-describedby="profile-department-hint" />
                        <p id="profile-department-hint" className="text-xs text-muted-foreground">Contact HR to change department assignment</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="profile-address">Address</Label>
                      <Input
                        id="profile-address"
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        disabled={!isEditing}
                        className={EDITABLE_FIELD}
                        placeholder="Enter your address"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="profile-city">City</Label>
                        <Input
                          id="profile-city"
                          value={formData.city}
                          onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                          disabled={!isEditing}
                          className={EDITABLE_FIELD}
                          placeholder="Enter city"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="profile-country">Country</Label>
                        <Input
                          id="profile-country"
                          value={formData.country}
                          onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                          disabled={!isEditing}
                          className={EDITABLE_FIELD}
                          placeholder="Enter country"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="min-w-0 space-y-2">
                        <Label htmlFor="profile-dob">Date of birth</Label>
                        <Input
                          id="profile-dob"
                          type="date"
                          value={formData.date_of_birth}
                          onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                          disabled={!isEditing}
                          className={`min-w-0 ${EDITABLE_FIELD}`}
                          max={new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate()).toISOString().split('T')[0]}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="profile-gender">Gender</Label>
                        <Select
                          value={formData.gender}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                          disabled={!isEditing}
                        >
                          <SelectTrigger id="profile-gender" className={EDITABLE_FIELD}>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator />

                    {/* Working Schedule Section */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="flex items-center gap-2 text-base font-medium">
                          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          Working schedule
                        </h4>
                        <p className="text-sm text-muted-foreground">Set your working hours and days for attendance reminders</p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="min-w-0 space-y-2">
                          <Label htmlFor="profile-start-time">Work start time</Label>
                          <Input
                            id="profile-start-time"
                            type="time"
                            value={formData.working_hours_start}
                            onChange={(e) => setFormData(prev => ({ ...prev, working_hours_start: e.target.value }))}
                            disabled={!isEditing}
                            className={`min-w-0 ${EDITABLE_FIELD}`}
                          />
                        </div>
                        <div className="min-w-0 space-y-2">
                          <Label htmlFor="profile-end-time">Work end time</Label>
                          <Input
                            id="profile-end-time"
                            type="time"
                            value={formData.working_hours_end}
                            onChange={(e) => setFormData(prev => ({ ...prev, working_hours_end: e.target.value }))}
                            disabled={!isEditing}
                            className={`min-w-0 ${EDITABLE_FIELD}`}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label id="profile-working-days-label">Working days</Label>
                        <WorkingDaysPicker
                          labelledBy="profile-working-days-label"
                          value={formData.working_days}
                          readOnly={!isEditing}
                          onChange={(days) => setFormData(prev => ({ ...prev, working_days: days }))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Leaves Tab */}
            <TabsContent value="leaves" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                  <LeaveBalanceCard employeeId={employee.id} />
                  <LeaveRequestHistory employeeId={employee.id} />
                </div>
                <div className="lg:col-span-1">
                  <LeaveRequestForm employeeId={employee.id} />
                </div>
              </div>
            </TabsContent>

            {/* Attendance Tab */}
            <TabsContent value="attendance" className="space-y-6">
              <MyAttendanceHistory employeeId={employee.id} />
            </TabsContent>

            {/* Assets Tab */}
            <TabsContent value="assets" className="space-y-6">
              <MyAssets employeeId={employee.id} />
            </TabsContent>

            {/* Reviews Tab */}
            <TabsContent value="reviews" className="space-y-6">
              <MyPerformanceReviews employeeId={employee.id} />
            </TabsContent>

            {/* Payslips Tab */}
            <TabsContent value="payslips" className="space-y-6">
              <PayslipViewer 
                employeeId={employee.id} 
                employeeName={`${employee.first_name} ${employee.last_name}`}
                employeeCode={employee.employee_code}
              />
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-6">
              <TaxDocumentsViewer employeeId={employee.id} />
              <EmployeeDocuments employeeId={employee.id} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Profile;
