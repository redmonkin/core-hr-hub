import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { isValidEmployeeCode } from "@/hooks/useNextEmployeeCode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Employee } from "./EmployeeTable";
import { Loader2, Hash } from "lucide-react";

const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

interface EmployeeEditDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditFormData {
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  date_of_birth: string;
  gender: string;
  designation: string;
  department_id: string;
  manager_id: string;
  hire_date: string;
  employment_type: string;
  working_hours_start: string;
  working_hours_end: string;
  working_days: number[];
  status: string;
}

export function EmployeeEditDialog({ employee, open, onOpenChange }: EmployeeEditDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<EditFormData>({
    employee_code: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    date_of_birth: "",
    gender: "",
    designation: "",
    department_id: "",
    manager_id: "",
    hire_date: "",
    employment_type: "full-time",
    working_hours_start: "09:00",
    working_hours_end: "18:00",
    working_days: [1, 2, 3, 4, 5],
    status: "active",
  });

  // Fetch full employee details when dialog opens
  const { data: employeeDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["employee-details", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return null;
      const { data, error } = await supabase
        .from("employees")
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
          date_of_birth,
          gender,
          designation,
          department_id,
          manager_id,
          hire_date,
          employment_type,
          working_hours_start,
          working_hours_end,
          working_days,
          status
        `)
        .eq("id", employee.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: open && !!employee?.id,
  });

  // Fetch managers (active employees who can be managers)
  const { data: managers = [] } = useQuery({
    queryKey: ["managers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, manager_id")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Check if employee is a department manager
  const isDepartmentManager = departments.some(
    (dept) => dept.manager_id === employee?.id
  );

  // Parse working hours from TIME format (HH:MM:SS) to input format (HH:MM)
  const parseTime = (time: string | null) => {
    if (!time) return '09:00';
    return time.substring(0, 5);
  };

  // Update form when employee details are loaded
  useEffect(() => {
    if (employeeDetails) {
      setFormData({
        employee_code: employeeDetails.employee_code || "",
        first_name: employeeDetails.first_name || "",
        last_name: employeeDetails.last_name || "",
        email: employeeDetails.email || "",
        phone: employeeDetails.phone || "",
        address: employeeDetails.address || "",
        city: employeeDetails.city || "",
        country: employeeDetails.country || "",
        date_of_birth: employeeDetails.date_of_birth || "",
        gender: employeeDetails.gender || "",
        designation: employeeDetails.designation || "",
        department_id: employeeDetails.department_id || "",
        manager_id: employeeDetails.manager_id || "",
        hire_date: employeeDetails.hire_date || "",
        employment_type: employeeDetails.employment_type || "full-time",
        working_hours_start: parseTime(employeeDetails.working_hours_start),
        working_hours_end: parseTime(employeeDetails.working_hours_end),
        working_days: employeeDetails.working_days || [1, 2, 3, 4, 5],
        status: employeeDetails.status || "active",
      });
    }
  }, [employeeDetails]);

  const updateMutation = useMutation({
    mutationFn: async (data: EditFormData) => {
      const { error } = await supabase
        .from("employees")
        .update({
          employee_code: data.employee_code.trim().toUpperCase(),
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone || null,
          address: data.address || null,
          city: data.city || null,
          country: data.country || null,
          date_of_birth: data.date_of_birth || null,
          gender: data.gender || null,
          designation: data.designation,
          department_id: data.department_id || null,
          manager_id: data.manager_id || null,
          hire_date: data.hire_date,
          employment_type: data.employment_type || null,
          working_hours_start: data.working_hours_start ? `${data.working_hours_start}:00` : '09:00:00',
          working_hours_end: data.working_hours_end ? `${data.working_hours_end}:00` : '18:00:00',
          working_days: data.working_days,
          status: data.status as "active" | "inactive" | "onboarding" | "offboarded",
        })
        .eq("id", employee?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Failed to update employee: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_code || !isValidEmployeeCode(formData.employee_code)) {
      toast.error("Employee code must be in format ACQ001");
      return;
    }
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.designation) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!isDepartmentManager && !formData.manager_id) {
      toast.error("Reporting manager is required for non-department managers");
      return;
    }
    updateMutation.mutate(formData);
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>
        {isLoadingDetails ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="job">Job Details</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="employee_code">Employee Number *</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="employee_code"
                      value={formData.employee_code}
                      onChange={(e) => setFormData({ ...formData, employee_code: e.target.value.toUpperCase() })}
                      className="pl-9 font-mono"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => setFormData({ ...formData, gender: value })}
                    >
                      <SelectTrigger>
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

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="job" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="designation">Designation *</Label>
                    <Input
                      id="designation"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hire_date">Join Date *</Label>
                    <Input
                      id="hire_date"
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Select
                      value={formData.department_id}
                      onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employment_type">Employment Type</Label>
                    <Select
                      value={formData.employment_type}
                      onValueChange={(value) => setFormData({ ...formData, employment_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full-time">Full-time</SelectItem>
                        <SelectItem value="part-time">Part-time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="intern">Intern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manager">
                    Reporting Manager {!isDepartmentManager && '*'}
                  </Label>
                  <Select
                    value={formData.manager_id}
                    onValueChange={(value) => setFormData({ ...formData, manager_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {isDepartmentManager && <SelectItem value="none">No Manager</SelectItem>}
                      {managers
                        .filter((mgr) => mgr.id !== employee?.id)
                        .map((mgr) => (
                          <SelectItem key={mgr.id} value={mgr.id}>
                            {mgr.first_name} {mgr.last_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {!isDepartmentManager && (
                    <p className="text-xs text-muted-foreground">
                      Required for employees who are not department managers
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                      <SelectItem value="offboarded">Offboarded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="working_hours_start">Work Start Time</Label>
                    <Input
                      id="working_hours_start"
                      type="time"
                      value={formData.working_hours_start}
                      onChange={(e) => setFormData({ ...formData, working_hours_start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="working_hours_end">Work End Time</Label>
                    <Input
                      id="working_hours_end"
                      type="time"
                      value={formData.working_hours_end}
                      onChange={(e) => setFormData({ ...formData, working_hours_end: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Working Days</Label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => (
                      <label
                        key={day.value}
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={formData.working_days.includes(day.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({
                                ...formData,
                                working_days: [...formData.working_days, day.value].sort(),
                              });
                            } else {
                              setFormData({
                                ...formData,
                                working_days: formData.working_days.filter((d) => d !== day.value),
                              });
                            }
                          }}
                        />
                        <span className="text-sm">{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
