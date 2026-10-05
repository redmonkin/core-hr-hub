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
import { WorkingDaysPicker } from "@/components/employees/WorkingDaysPicker";
import { statusBadgeClass } from "@/lib/statusStyles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Upload, User, Briefcase, FileText, Loader2, ShieldAlert, Calendar, Mail, Phone, MapPin, Pencil, X, Check, Download, ExternalLink, Send, Clock, UserPlus, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDepartments } from "@/hooks/useEmployees";
import { useNextEmployeeCode, isValidEmployeeCode } from "@/hooks/useNextEmployeeCode";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { PendingHires } from "@/components/onboarding/PendingHires";
import { LeavingList } from "@/components/offboarding/LeavingList";
import { useEmployeeExits } from "@/hooks/useOffboarding";
import { sendInvitation } from "@/components/onboarding/inviteEmployee";
import { useLocation } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
          email,
          phone,
          address,
          avatar_url,
          hire_date,
          designation,
          department_id,
          manager_id,
          user_id,
          working_hours_start,
          working_hours_end,
          working_days,
          departments!employees_department_id_fkey (name)
        `)
        .eq('status', 'onboarding');
      
      if (error) throw error;
      return data || [];
    },
  });
};

type OnboardingEmployee = NonNullable<ReturnType<typeof useOnboardingEmployees>["data"]>[number];

// Fetch documents for a specific employee
const useEmployeeDocuments = (employeeId: string | null) => {
  return useQuery({
    queryKey: ['employee-documents', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('employee_id', employeeId)
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
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


interface DocumentUpload {
  file: File | null;
  uploading: boolean;
  uploaded: boolean;
  url: string | null;
}

interface FormData {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  gender: string;
  departmentId: string;
  designation: string;
  managerId: string;
  joinDate: string;
  isDepartmentManager: boolean;
  sendInvite: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
}

const initialFormData: FormData = {
  employeeCode: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  dateOfBirth: '',
  gender: '',
  departmentId: '',
  designation: '',
  managerId: '',
  joinDate: '',
  isDepartmentManager: false,
  sendInvite: true,
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri
};

const REQUIRED_DOCUMENT_TYPES = [
  { key: 'id_proof', label: 'ID Proof', accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'offer_letter', label: 'Offer Letter', accept: '.pdf,.doc,.docx' },
  { key: 'resume', label: 'Resume', accept: '.pdf,.doc,.docx' },
];

const ALL_DOCUMENT_TYPES = [
  { key: 'contract', label: 'Contract', accept: '.pdf,.doc,.docx' },
  ...REQUIRED_DOCUMENT_TYPES,
  { key: 'other', label: 'Others', accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png' },
];

const initialDocuments: Record<string, DocumentUpload> = {
  id_proof: { file: null, uploading: false, uploaded: false, url: null },
  offer_letter: { file: null, uploading: false, uploaded: false, url: null },
  resume: { file: null, uploading: false, uploaded: false, url: null },
};

const Onboarding = () => {
  const currentLocation = useLocation();
  const searchParams = new URLSearchParams(currentLocation.search);
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'add');
  const [selectedEmployee, setSelectedEmployee] = useState<OnboardingEmployee | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    departmentId: '',
    designation: '',
    managerId: '',
    joinDate: '',
    workingHoursStart: '09:00',
    workingHoursEnd: '18:00',
    workingDays: [1, 2, 3, 4, 5] as number[],
  });
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [documents, setDocuments] = useState<Record<string, DocumentUpload>>(initialDocuments);
  const [additionalDoc, setAdditionalDoc] = useState<{ file: File | null; type: string }>({ file: null, type: '' });
  const [isUploadingAdditional, setIsUploadingAdditional] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can, isLoading: roleLoading } = usePermissions();
  const canView = can('onboarding', 'view');
  const canManage = can('onboarding', 'manage');
  const { data: exits = [] } = useEmployeeExits(canView);
  
  const { data: departments = [], isLoading: loadingDepartments } = useDepartments();
  const { data: managers = [], isLoading: loadingManagers } = useManagers();
  const { data: onboardingEmployees = [], isLoading: loadingOnboarding } = useOnboardingEmployees();
  const { data: employeeDocs = [], isLoading: loadingDocs } = useEmployeeDocuments(selectedEmployee?.id || null);
  const { data: nextEmployeeCode, isLoading: loadingNextCode } = useNextEmployeeCode();

  // Get signed URL for document download
  const getDocumentUrl = async (filePath: string, bucket: 'employee-documents' | 'onboarding-documents' = 'employee-documents') => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      toast({
        title: "Error",
        description: "Failed to get document URL",
        variant: "destructive",
      });
      return null;
    }
    return data.signedUrl;
  };

  const handleViewDocument = async (filePath: string, bucket: 'employee-documents' | 'onboarding-documents' = 'employee-documents') => {
    const url = await getDocumentUrl(filePath, bucket);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleDownloadDocument = async (filePath: string, fileName: string, bucket: 'employee-documents' | 'onboarding-documents' = 'employee-documents') => {
    const url = await getDocumentUrl(filePath, bucket);
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleFileSelect = (docType: string, file: File | null) => {
    setDocuments(prev => ({
      ...prev,
      [docType]: { ...prev[docType], file, uploaded: false, url: null }
    }));
  };

  // Upload a single document
  const uploadDocument = async (employeeId: string, docType: string, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${employeeId}/${docType}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('employee-documents')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('employee-documents')
      .getPublicUrl(fileName);

    // Store document reference in database
    const { error: dbError } = await supabase
      .from('employee_documents')
      .insert({
        employee_id: employeeId,
        document_type: docType,
        document_name: file.name,
        file_url: fileName, // Store path, not public URL (bucket is private)
      });

    if (dbError) throw dbError;

    return fileName;
  };

  // Upload additional document for existing employee
  const handleUploadAdditionalDocument = async () => {
    if (!selectedEmployee || !additionalDoc.file || !additionalDoc.type) {
      toast({
        title: "Error",
        description: "Please select a document type and file",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingAdditional(true);
    try {
      await uploadDocument(selectedEmployee.id, additionalDoc.type, additionalDoc.file);
      queryClient.invalidateQueries({ queryKey: ['employee-documents', selectedEmployee.id] });
      setAdditionalDoc({ file: null, type: '' });
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAdditional(false);
    }
  };

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const selectedDept = departments.find(d => d.id === data.departmentId);
      const warnings: string[] = [];

      // New hires wait in 'onboarding' until they accept their invitation; people
      // who won't sign in (no invitation) are active straight away.
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .insert({
          employee_code: data.employeeCode.trim().toUpperCase(),
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          email: data.email.trim().toLowerCase(),
          phone: data.phone.trim() || null,
          address: data.address.trim() || null,
          date_of_birth: data.dateOfBirth || null,
          gender: data.gender || null,
          department_id: data.departmentId || null,
          designation: data.designation.trim(),
          manager_id: data.managerId || null,
          hire_date: data.joinDate,
          status: data.sendInvite ? 'onboarding' : 'active',
          working_hours_start: data.workingHoursStart ? `${data.workingHoursStart}:00` : '09:00:00',
          working_hours_end: data.workingHoursEnd ? `${data.workingHoursEnd}:00` : '18:00:00',
          working_days: data.workingDays,
        })
        .select()
        .single();

      if (employeeError) throw employeeError;

      for (const [docType, doc] of Object.entries(documents)) {
        if (!doc.file) continue;
        try {
          await uploadDocument(employee.id, docType, doc.file);
        } catch (err) {
          console.error(`Failed to upload ${docType}:`, err);
          warnings.push(`${doc.file.name} couldn't be uploaded`);
        }
      }

      // Tell the manager and HR about the new joiner (fire and forget)
      supabase.functions.invoke("onboarding-notification", {
        body: {
          employee_id: employee.id,
          employee_name: `${data.firstName.trim()} ${data.lastName.trim()}`,
          employee_email: data.email.trim(),
          designation: data.designation.trim(),
          department_name: selectedDept?.name,
          join_date: data.joinDate,
          manager_id: data.managerId || undefined,
        }
      }).catch(err => {
        console.error("Failed to send onboarding notification:", err);
      });

      let invite: 'sent' | 'linked' | 'skipped' | 'failed' = 'skipped';
      let inviteError: string | null = null;
      if (data.sendInvite) {
        try {
          const result = await sendInvitation(employee.id);
          invite = result.status === 'linked' ? 'linked' : 'sent';
        } catch (err) {
          invite = 'failed';
          inviteError = err instanceof Error ? err.message : 'Unknown error';
        }
      }

      return { employee, invite, inviteError, warnings };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['next-employee-code'] });
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
      setFormData(initialFormData);
      setDocuments(initialDocuments);
      const name = result.employee.first_name;
      if (result.invite === 'failed') {
        setActiveTab('pending');
        toast({
          title: `${name} was added, but the invitation wasn't sent`,
          description: `${result.inviteError} Fix the problem, then use "Send invitation" in Pending.`,
          variant: "destructive",
        });
      } else if (result.invite === 'sent') {
        setActiveTab('pending');
        toast({
          title: "Employee added and invited",
          description: `${name} will get an email at ${result.employee.email} to set up their account. They'll show in Pending until they do.`,
        });
      } else if (result.invite === 'linked') {
        toast({
          title: "Employee added",
          description: `${result.employee.email} already had an account, so ${name} is linked and active.`,
        });
      } else {
        toast({
          title: "Employee added",
          description: `${name} is active. They can't sign in until you invite them from their row in Employees.`,
        });
      }
      if (result.warnings.length > 0) {
        toast({
          title: "Some details weren't saved",
          description: result.warnings.join('. ') + '.',
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Employee not added",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mark someone as joined without waiting for them to accept the invitation
  // (e.g. they won't use the app). Leave balances are created by the database.
  const activateEmployeeMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from('employees')
        .update({ status: 'active' })
        .eq('id', employeeId);
      if (error) throw error;
      return employeeId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setSelectedEmployee(null);
      toast({
        title: "Marked as joined",
        description: "They're now active and their leave balances are set up. Any invitation they have still works.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to activate employee.",
        variant: "destructive",
      });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async (data: typeof editFormData & { id: string }) => {
      const { error } = await supabase
        .from('employees')
        .update({
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          email: data.email.trim(),
          phone: data.phone.trim() || null,
          address: data.address.trim() || null,
          department_id: data.departmentId || null,
          designation: data.designation.trim(),
          manager_id: data.managerId || null,
          hire_date: data.joinDate,
          working_hours_start: data.workingHoursStart ? `${data.workingHoursStart}:00` : '09:00:00',
          working_hours_end: data.workingHoursEnd ? `${data.workingHoursEnd}:00` : '18:00:00',
          working_days: data.workingDays,
        })
        .eq('id', data.id);
      
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsEditing(false);
      setSelectedEmployee(null);
      toast({
        title: "Employee Updated",
        description: "Employee details have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update employee.",
        variant: "destructive",
      });
    },
  });

  const openEditMode = (employee: OnboardingEmployee) => {
    // Parse working hours from TIME format (HH:MM:SS) to input format (HH:MM)
    const parseTime = (time: string | null) => {
      if (!time) return '09:00';
      return time.substring(0, 5); // Extract HH:MM from HH:MM:SS
    };
    
    setEditFormData({
      firstName: employee.first_name || '',
      lastName: employee.last_name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      address: employee.address || '',
      departmentId: employee.department_id || '',
      designation: employee.designation || '',
      managerId: employee.manager_id || '',
      joinDate: employee.hire_date || '',
      workingHoursStart: parseTime(employee.working_hours_start),
      workingHoursEnd: parseTime(employee.working_hours_end),
      workingDays: employee.working_days || [1, 2, 3, 4, 5],
    });
    setIsEditing(true);
  };

  const handleEditSubmit = () => {
    if (!selectedEmployee) return;
    
    if (!editFormData.firstName.trim()) {
      toast({ title: "Error", description: "First name is required", variant: "destructive" });
      return;
    }
    if (!editFormData.lastName.trim()) {
      toast({ title: "Error", description: "Last name is required", variant: "destructive" });
      return;
    }
    if (!editFormData.email.trim()) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    if (!editFormData.designation.trim()) {
      toast({ title: "Error", description: "Designation is required", variant: "destructive" });
      return;
    }
    if (!editFormData.joinDate) {
      toast({ title: "Error", description: "Join date is required", variant: "destructive" });
      return;
    }

    updateEmployeeMutation.mutate({ ...editFormData, id: selectedEmployee.id });
  };

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canView) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
          <ShieldAlert className="h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold text-foreground">Access denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <p className="text-sm text-muted-foreground">Ask an administrator for access to onboarding.</p>
        </div>
      </DashboardLayout>
    );
  }

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Use next code if not set
    const codeToUse = formData.employeeCode.trim() || nextEmployeeCode || '';
    
    // Validation
    if (!codeToUse) {
      toast({ title: "Error", description: "Employee code is required", variant: "destructive" });
      return;
    }
    if (!isValidEmployeeCode(codeToUse)) {
      toast({ title: "Error", description: "Employee code must be in format ACQ001", variant: "destructive" });
      return;
    }
    if (!formData.firstName.trim()) {
      toast({ title: "Error", description: "First name is required", variant: "destructive" });
      return;
    }
    if (!formData.lastName.trim()) {
      toast({ title: "Error", description: "Last name is required", variant: "destructive" });
      return;
    }
    if (!formData.email.trim()) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    if (!formData.designation.trim()) {
      toast({ title: "Error", description: "Designation is required", variant: "destructive" });
      return;
    }
    if (!formData.joinDate) {
      toast({ title: "Error", description: "Join date is required", variant: "destructive" });
      return;
    }
    if (!formData.isDepartmentManager && !formData.managerId) {
      toast({ title: "Error", description: "Reporting manager is required for non-department managers", variant: "destructive" });
      return;
    }

    createEmployeeMutation.mutate({ ...formData, employeeCode: codeToUse });
  };

  const isSubmitting = createEmployeeMutation.isPending;

  // People with onboarding:view only can't create employees, so no Add tab
  const availableTabs = canManage ? ['add', 'pending', 'leaving'] : ['pending', 'leaving'];
  const currentTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0];
  const pendingOnboardingCount = onboardingEmployees.length;
  const leavingCount = exits.filter((x) => x.status === 'requested' || x.status === 'in_progress').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {!canManage && (
          <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            You have view-only access to onboarding. Ask an administrator if you need to add employees or send
            invitations.
          </p>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Onboarding</h1>
          <p className="text-muted-foreground">
            Add new hires and invite them to set up their account, and see who's leaving.
          </p>
        </div>
        <Tabs value={currentTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full justify-start sm:w-auto sm:max-w-2xl">
            {canManage && (
              <TabsTrigger value="add" className="shrink-0 px-2 sm:px-3">
                Add<span className="hidden sm:inline">&nbsp;employee</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="pending" className="shrink-0 px-2 sm:px-3">
              Pending
              {pendingOnboardingCount > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs font-semibold tabular-nums text-primary" aria-label={`${pendingOnboardingCount} pending`}>
                  {pendingOnboardingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="leaving" className="shrink-0 px-2 sm:px-3">
              Leaving
              {leavingCount > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs font-semibold tabular-nums text-primary" aria-label={`${leavingCount} leaving`}>
                  {leavingCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {canManage && (
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
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input 
                          id="firstName" 
                          placeholder="John" 
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input 
                          id="lastName" 
                          placeholder="Doe" 
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="john.doe@company.com" 
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input 
                        id="phone" 
                        placeholder="+1 (555) 000-0000" 
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        placeholder="Enter full address"
                        rows={3}
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dateOfBirth">Date of Birth</Label>
                        <Input
                          id="dateOfBirth"
                          type="date"
                          value={formData.dateOfBirth}
                          onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gender">Gender</Label>
                        <Select
                          value={formData.gender}
                          onValueChange={(value) => handleInputChange('gender', value)}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger id="gender">
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
                      <Label htmlFor="employeeCode">Employee Number *</Label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input 
                          id="employeeCode" 
                          placeholder={loadingNextCode ? "Loading..." : nextEmployeeCode || "ACQ001"}
                          value={formData.employeeCode}
                          onChange={(e) => handleInputChange('employeeCode', e.target.value.toUpperCase())}
                          disabled={isSubmitting || loadingNextCode}
                          className="pl-9 font-mono"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Next available: {loadingNextCode ? "..." : nextEmployeeCode}. You can customize if needed.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Select 
                        disabled={loadingDepartments || isSubmitting}
                        value={formData.departmentId}
                        onValueChange={(value) => handleInputChange('departmentId', value)}
                      >
                        <SelectTrigger id="department">
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
                      <Label htmlFor="designation">Designation *</Label>
                      <Input 
                        id="designation" 
                        placeholder="e.g., Senior Developer" 
                        value={formData.designation}
                        onChange={(e) => handleInputChange('designation', e.target.value)}
                        disabled={isSubmitting}
                      />
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
                        checked={formData.isDepartmentManager}
                        onCheckedChange={(checked) => handleInputChange('isDepartmentManager', checked)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manager">
                        Reporting Manager {!formData.isDepartmentManager && '*'}
                      </Label>
                      <Select 
                        disabled={loadingManagers || isSubmitting}
                        value={formData.managerId}
                        onValueChange={(value) => handleInputChange('managerId', value)}
                      >
                        <SelectTrigger id="manager">
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
                      {!formData.isDepartmentManager && (
                        <p className="text-xs text-muted-foreground">
                          Required for employees who are not department managers
                        </p>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="joinDate">Join Date *</Label>
                        <Input 
                          id="joinDate" 
                          type="date" 
                          value={formData.joinDate}
                          onChange={(e) => handleInputChange('joinDate', e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                    
                    {/* Working Hours Section */}
                    <div className="space-y-4 rounded-lg border border-border p-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <Label className="text-base font-medium">Working Schedule</Label>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="workingHoursStart">Start Time</Label>
                          <Input 
                            id="workingHoursStart" 
                            type="time" 
                            value={formData.workingHoursStart}
                            onChange={(e) => handleInputChange('workingHoursStart', e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="workingHoursEnd">End Time</Label>
                          <Input 
                            id="workingHoursEnd" 
                            type="time" 
                            value={formData.workingHoursEnd}
                            onChange={(e) => handleInputChange('workingHoursEnd', e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label id="add-working-days-label">Working days</Label>
                        <WorkingDaysPicker
                          labelledBy="add-working-days-label"
                          value={formData.workingDays}
                          disabled={isSubmitting}
                          onChange={(days) => setFormData(prev => ({ ...prev, workingDays: days }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Select the days this employee will work
                        </p>
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
                        <CardDescription>Upload required documents (optional)</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {REQUIRED_DOCUMENT_TYPES.map((docType) => {
                        const doc = documents[docType.key];
                        return (
                          <label
                            key={docType.key}
                            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer ${
                              doc.file 
                                ? 'border-primary bg-primary/5' 
                                : 'border-border hover:border-primary hover:bg-primary/5'
                            } ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            <input
                              type="file"
                              accept={docType.accept}
                              className="sr-only"
                              disabled={isSubmitting}
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                handleFileSelect(docType.key, file);
                              }}
                            />
                            {doc.file ? (
                              <>
                                <Check className="mb-2 h-8 w-8 text-primary" />
                                <p className="text-sm font-medium text-foreground truncate max-w-full px-2">
                                  {doc.file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {(doc.file.size / 1024).toFixed(1)} KB
                                </p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute top-1 right-1 h-9 w-9"
                                  aria-label={`Remove ${docType.label} file`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleFileSelect(docType.key, null);
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                                <p className="text-sm font-medium text-foreground">{docType.label}</p>
                                <p className="text-xs text-muted-foreground">Click to upload</p>
                              </>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <Switch
                      id="sendInvite"
                      checked={formData.sendInvite}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, sendInvite: checked }))}
                      disabled={isSubmitting}
                      className="mt-0.5"
                    />
                    <div>
                      <Label htmlFor="sendInvite" className="font-medium">Invite them to set up their account</Label>
                      <p className="text-sm text-muted-foreground">
                        {formData.sendInvite
                          ? "We'll email a link to choose a password. They stay in Pending until they do, then become active."
                          : "No email is sent. They're added as active, and you can invite them later from Employees."}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 justify-end gap-3">
                    <Button
                      variant="outline"
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setFormData(initialFormData);
                        setDocuments(initialDocuments);
                      }}
                    >
                      Clear form
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : formData.sendInvite ? (
                        <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                      ) : (
                        <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      {formData.sendInvite ? "Add and invite" : "Add employee"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </TabsContent>
          )}

          <TabsContent value="pending" className="mt-6">
            <PendingHires
              hires={onboardingEmployees}
              isLoading={loadingOnboarding}
              canManage={canManage}
              onAddEmployee={canManage ? () => setActiveTab('add') : undefined}
              onOpenDetails={(id) => setSelectedEmployee(onboardingEmployees.find((e) => e.id === id) ?? null)}
            />
          </TabsContent>

          <TabsContent value="leaving" className="mt-6">
            <LeavingList canManage={canManage} />
          </TabsContent>
        </Tabs>

        {/* Employee Details Dialog */}
        <Dialog 
          open={!!selectedEmployee} 
          onOpenChange={(open) => {
            if (!open) {
              setSelectedEmployee(null);
              setIsEditing(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Employee' : 'Employee Details'}</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Update onboarding employee information' : 'Onboarding employee information'}
              </DialogDescription>
            </DialogHeader>
            {selectedEmployee && !isEditing && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={selectedEmployee.avatar_url || undefined} />
                      <AvatarFallback className="text-lg">
                        {`${selectedEmployee.first_name} ${selectedEmployee.last_name}`.split(" ").map((n: string) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-lg font-semibold">{selectedEmployee.first_name} {selectedEmployee.last_name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedEmployee.designation || 'No designation'}</p>
                    </div>
                  </div>
                  {canManage && (
                    <Button variant="outline" size="icon" onClick={() => openEditMode(selectedEmployee)} aria-label="Edit employee details" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Department</p>
                      <p className="text-sm font-medium">{selectedEmployee.departments?.name || 'Unassigned'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Start Date</p>
                      <p className="text-sm font-medium">
                        {selectedEmployee.hire_date 
                          ? new Date(selectedEmployee.hire_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                          : 'TBD'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{selectedEmployee.email || '-'}</p>
                    </div>
                  </div>
                  
                  {selectedEmployee.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="text-sm font-medium">{selectedEmployee.phone}</p>
                      </div>
                    </div>
                  )}
                  
                  {selectedEmployee.address && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Address</p>
                        <p className="text-sm font-medium">{selectedEmployee.address}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Working Schedule */}
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Working Schedule</p>
                      <p className="text-sm font-medium">
                        {selectedEmployee.working_hours_start?.substring(0, 5) || '09:00'} - {selectedEmployee.working_hours_end?.substring(0, 5) || '18:00'}
                      </p>
                      <WorkingDaysPicker
                        readOnly
                        className="mt-1 gap-1 [&>span]:h-7 [&>span]:min-w-[2.5rem] [&>span]:px-2 [&>span]:text-xs"
                        value={selectedEmployee.working_days || [1, 2, 3, 4, 5]}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Documents Section */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documents
                  </p>
                  {loadingDocs ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : employeeDocs.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No documents uploaded</p>
                  ) : (
                    <div className="space-y-2">
                      {employeeDocs.map((doc) => {
                        const docTypeLabel = ALL_DOCUMENT_TYPES.find(d => d.key === doc.document_type)?.label || doc.document_type;
                        return (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{docTypeLabel}</p>
                                <p className="text-xs text-muted-foreground truncate">{doc.document_name}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleViewDocument(doc.file_url)}
                                title="View"
                                aria-label={`View ${docTypeLabel}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDownloadDocument(doc.file_url, doc.document_name)}
                                title="Download"
                                aria-label={`Download ${docTypeLabel}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Upload Additional Document */}
                  {canManage && (
                  <div className="space-y-3 pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground">Upload Additional Document</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select
                        value={additionalDoc.type}
                        onValueChange={(value) => setAdditionalDoc(prev => ({ ...prev, type: value }))}
                        disabled={isUploadingAdditional}
                      >
                        <SelectTrigger className="w-full sm:w-[140px]" aria-label="Document type">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_DOCUMENT_TYPES.map((docType) => (
                            <SelectItem key={docType.key} value={docType.key}>
                              {docType.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2 flex-1">
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          disabled={isUploadingAdditional}
                          aria-label="Document file"
                          onChange={(e) => setAdditionalDoc(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                          className="text-xs flex-1 min-w-0"
                        />
                        <Button
                          size="sm"
                          onClick={handleUploadAdditionalDocument}
                          aria-label="Upload document"
                          disabled={isUploadingAdditional || !additionalDoc.file || !additionalDoc.type}
                        >
                          {isUploadingAdditional ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {additionalDoc.file && (
                      <p className="text-xs text-muted-foreground truncate">
                        Selected: {additionalDoc.file.name}
                      </p>
                    )}
                  </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <Badge variant="outline" className={statusBadgeClass("onboarding")}>Onboarding</Badge>
                  {canManage && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm"
                        disabled={activateEmployeeMutation.isPending}
                      >
                        {activateEmployeeMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        Mark as joined
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Mark {selectedEmployee.first_name} as joined?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Use this if {selectedEmployee.first_name} has started but won't accept the invitation yet. They become active and get this year's leave balances. If they set up their account later, it's linked automatically.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => activateEmployeeMutation.mutate(selectedEmployee.id)}
                        >
                          Mark as joined
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  )}
                </div>
              </div>
            )}
            
            {selectedEmployee && isEditing && canManage && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-firstName">First Name *</Label>
                    <Input
                      id="edit-firstName"
                      value={editFormData.firstName}
                      onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                      disabled={updateEmployeeMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-lastName">Last Name *</Label>
                    <Input
                      id="edit-lastName"
                      value={editFormData.lastName}
                      onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                      disabled={updateEmployeeMutation.isPending}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    disabled={updateEmployeeMutation.isPending}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    disabled={updateEmployeeMutation.isPending}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-designation">Designation *</Label>
                  <Input
                    id="edit-designation"
                    value={editFormData.designation}
                    onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                    disabled={updateEmployeeMutation.isPending}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-department">Department</Label>
                  <Select
                    value={editFormData.departmentId}
                    onValueChange={(value) => setEditFormData({ ...editFormData, departmentId: value })}
                    disabled={updateEmployeeMutation.isPending || loadingDepartments}
                  >
                    <SelectTrigger id="edit-department">
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
                  <Label htmlFor="edit-manager">Manager</Label>
                  <Select
                    value={editFormData.managerId}
                    onValueChange={(value) => setEditFormData({ ...editFormData, managerId: value === 'none' ? '' : value })}
                    disabled={updateEmployeeMutation.isPending || loadingManagers}
                  >
                    <SelectTrigger id="edit-manager">
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No manager</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.first_name} {m.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-joinDate">Join Date *</Label>
                  <Input
                    id="edit-joinDate"
                    type="date"
                    value={editFormData.joinDate}
                    onChange={(e) => setEditFormData({ ...editFormData, joinDate: e.target.value })}
                    disabled={updateEmployeeMutation.isPending}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Textarea
                    id="edit-address"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    disabled={updateEmployeeMutation.isPending}
                    rows={2}
                  />
                </div>
                
                {/* Working Hours Section */}
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <Label className="text-base font-medium">Working Schedule</Label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-workingHoursStart">Start Time</Label>
                      <Input 
                        id="edit-workingHoursStart" 
                        type="time" 
                        value={editFormData.workingHoursStart}
                        onChange={(e) => setEditFormData({ ...editFormData, workingHoursStart: e.target.value })}
                        disabled={updateEmployeeMutation.isPending}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-workingHoursEnd">End Time</Label>
                      <Input 
                        id="edit-workingHoursEnd" 
                        type="time" 
                        value={editFormData.workingHoursEnd}
                        onChange={(e) => setEditFormData({ ...editFormData, workingHoursEnd: e.target.value })}
                        disabled={updateEmployeeMutation.isPending}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label id="edit-working-days-label">Working days</Label>
                    <WorkingDaysPicker
                      labelledBy="edit-working-days-label"
                      value={editFormData.workingDays}
                      disabled={updateEmployeeMutation.isPending}
                      onChange={(days) => setEditFormData({ ...editFormData, workingDays: days })}
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    disabled={updateEmployeeMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleEditSubmit}
                    disabled={updateEmployeeMutation.isPending}
                  >
                    {updateEmployeeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save changes
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default Onboarding;
