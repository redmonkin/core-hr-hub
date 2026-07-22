import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Clock, CheckCircle, XCircle, Send } from "lucide-react";
import { useState } from "react";
import { useOnboardingRequest } from "@/hooks/useOnboardingRequest";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const DOCUMENT_FIELDS = [
  { key: "resume" as const, label: "Resume", accept: ".pdf,.doc,.docx" },
  { key: "offerLetter" as const, label: "Offer Letter", accept: ".pdf,.doc,.docx" },
  { key: "idProof" as const, label: "ID Proof", accept: ".pdf,.jpg,.jpeg,.png" },
];

interface FormState {
  phone: string;
  address: string;
  dateOfBirth: string;
  gender: string;
  designation: string;
  joiningDate: string;
  message: string;
}

const initialFormState: FormState = {
  phone: "",
  address: "",
  dateOfBirth: "",
  gender: "",
  designation: "",
  joiningDate: "",
  message: "",
};

export function NonEmployeeDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { request, isLoading, submitRequest } = useOnboardingRequest();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [files, setFiles] = useState<{ resume: File | null; offerLetter: File | null; idProof: File | null }>({
    resume: null,
    offerLetter: null,
    idProof: null,
  });

  const handleSubmit = () => {
    if (
      !form.phone.trim() ||
      !form.address.trim() ||
      !form.dateOfBirth ||
      !form.gender ||
      !form.designation.trim() ||
      !form.joiningDate
    ) {
      toast({ title: "Missing information", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    if (!files.resume || !files.offerLetter || !files.idProof) {
      toast({ title: "Missing documents", description: "Please upload your resume, offer letter, and ID proof.", variant: "destructive" });
      return;
    }

    submitRequest.mutate({
      phone: form.phone.trim(),
      address: form.address.trim(),
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      designation: form.designation.trim(),
      joiningDate: form.joiningDate,
      message: form.message.trim() || undefined,
      resume: files.resume,
      offerLetter: files.offerLetter,
      idProof: files.idProof,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending Review
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <UserPlus className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to HR Hub!</CardTitle>
          <CardDescription>
            {request
              ? "Your onboarding request has been submitted."
              : "You're not registered as an employee yet. Submit a request to HR to get started."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {request ? (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Request Status</span>
                  {getStatusBadge(request.status)}
                </div>
                <p className="mt-2 text-sm">
                  Submitted on{" "}
                  {new Date(request.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                {request.message && (
                  <div className="mt-3 rounded bg-muted p-3">
                    <p className="text-sm font-medium">Your message:</p>
                    <p className="mt-1 text-sm text-muted-foreground">{request.message}</p>
                  </div>
                )}
              </div>
              {request.status === "pending" && (
                <p className="text-center text-sm text-muted-foreground">
                  HR will review your request and get back to you soon.
                </p>
              )}
              {request.status === "approved" && (
                <p className="text-center text-sm text-muted-foreground">
                  Your account is being set up. Please refresh the page or wait for HR to complete
                  your onboarding.
                </p>
              )}
              {request.status === "rejected" && (
                <p className="text-center text-sm text-muted-foreground">
                  Please contact HR directly for more information.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">Request will be sent as:</p>
                <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="e.g., +91 98765 43210"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="designation">Designation *</Label>
                  <Input
                    id="designation"
                    value={form.designation}
                    onChange={(e) => setForm((prev) => ({ ...prev, designation: e.target.value }))}
                    placeholder="e.g., Software Engineer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth *</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                    max={new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate()).toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select value={form.gender} onValueChange={(value) => setForm((prev) => ({ ...prev, gender: value }))}>
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
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="joining_date">Preferred Joining Date *</Label>
                  <Input
                    id="joining_date"
                    type="date"
                    value={form.joiningDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, joiningDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Textarea
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Your current residential address"
                  rows={2}
                />
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Documents *</p>
                {DOCUMENT_FIELDS.map((doc) => (
                  <div key={doc.key} className="space-y-1">
                    <Label htmlFor={doc.key} className="text-sm text-muted-foreground">{doc.label}</Label>
                    <Input
                      id={doc.key}
                      type="file"
                      accept={doc.accept}
                      onChange={(e) => setFiles((prev) => ({ ...prev, [doc.key]: e.target.files?.[0] || null }))}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-medium">
                  Message to HR (optional)
                </label>
                <Textarea
                  id="message"
                  placeholder="Introduce yourself or provide any relevant information..."
                  value={form.message}
                  onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitRequest.isPending}
                className="w-full gap-2"
              >
                <Send className="h-4 w-4" />
                {submitRequest.isPending ? "Submitting..." : "Request Onboarding"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
