import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Upload, User, Briefcase, FileText, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDepartments, useEmployees } from "@/hooks/useEmployees";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Fetch employees who are in onboarding status
const useOnboardingEmployees = () => {
  return useQuery({
    queryKey: ['onboarding-employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          id,
          first_name,
          last_name,
          avatar_url,
          hire_date,
          department_id,
          departments (name)
        `)
        .eq('status', 'onboarding');
      
      if (error) throw error;
      return data || [];
    },
  });
};

// Fetch active employees who can be managers
const useManagers = () => {
  return useQuery({
    queryKey: ['managers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('status', 'active')
        .order('first_name');
      
      if (error) throw error;
      return data || [];
    },
  });
};

const Onboarding = () => {
  const [activeTab, setActiveTab] = useState("add");
  const [isDepartmentManager, setIsDepartmentManager] = useState(false);
  const { toast } = useToast();
  
  const { data: departments = [], isLoading: loadingDepartments } = useDepartments();
  const { data: managers = [], isLoading: loadingManagers } = useManagers();
  const { data: onboardingEmployees = [], isLoading: loadingOnboarding } = useOnboardingEmployees();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Employee Added",
      description: "New employee has been added to the onboarding queue.",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="add">Add New Employee</TabsTrigger>
            <TabsTrigger value="pending">
              Pending Onboarding
              <Badge variant="secondary" className="ml-2">
                {onboardingEmployees.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="mt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Personal Information */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Personal Information</CardTitle>
                        <CardDescription>Basic details of the employee</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input id="firstName" placeholder="John" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" placeholder="Doe" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" type="email" placeholder="john.doe@company.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" placeholder="+1 (555) 000-0000" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Textarea id="address" placeholder="Enter full address" rows={3} />
                    </div>
                  </CardContent>
                </Card>

                {/* Job Information */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Briefcase className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Job Information</CardTitle>
                        <CardDescription>Role and department details</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Select disabled={loadingDepartments}>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingDepartments ? "Loading..." : "Select department"} />
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
                      <Label htmlFor="designation">Designation</Label>
                      <Input id="designation" placeholder="e.g., Senior Developer" />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="isDeptManager">Department Manager</Label>
                        <p className="text-xs text-muted-foreground">
                          Tag this employee as the head of their department
                        </p>
                      </div>
                      <Switch
                        id="isDeptManager"
                        checked={isDepartmentManager}
                        onCheckedChange={setIsDepartmentManager}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manager">Reporting Manager</Label>
                      <Select disabled={loadingManagers}>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingManagers ? "Loading..." : "Select manager"} />
                        </SelectTrigger>
                        <SelectContent>
                          {managers.map((manager) => (
                            <SelectItem key={manager.id} value={manager.id}>
                              {manager.first_name} {manager.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="joinDate">Join Date</Label>
                        <Input id="joinDate" type="date" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="salary">Base Salary</Label>
                        <Input id="salary" type="number" placeholder="50000" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Documents */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Documents</CardTitle>
                        <CardDescription>Upload required documents</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {["ID Proof", "Offer Letter", "Resume"].map((doc) => (
                        <div
                          key={doc}
                          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 transition-colors hover:border-primary hover:bg-primary/5"
                        >
                          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                          <p className="text-sm font-medium text-foreground">{doc}</p>
                          <p className="text-xs text-muted-foreground">Click to upload</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button">
                  Save as Draft
                </Button>
                <Button type="submit">Add Employee</Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="pending" className="mt-6">
            <div className="space-y-4">
              {loadingOnboarding ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Loading onboarding employees...
                  </CardContent>
                </Card>
              ) : onboardingEmployees.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No employees currently in onboarding
                  </CardContent>
                </Card>
              ) : (
                onboardingEmployees.map((employee) => {
                  const name = `${employee.first_name} ${employee.last_name}`;
                  const departmentName = employee.departments?.name || 'Unassigned';
                  const hireDate = employee.hire_date 
                    ? new Date(employee.hire_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'TBD';
                  
                  return (
                    <Card key={employee.id}>
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={employee.avatar_url || undefined} />
                              <AvatarFallback>
                                {name.split(" ").map((n) => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold text-foreground">{name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {departmentName} · Starts {hireDate}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant="secondary">Onboarding</Badge>
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Onboarding;
