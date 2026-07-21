import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Building2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useCompanyBranding,
  useUpdateCompanyBranding,
  useUploadBrandingAsset,
  type CompanyBranding,
} from "@/hooks/useCompanyBranding";

function AssetUploader({
  label,
  helperText,
  imageUrl,
  onUpload,
  isUploading,
}: {
  label: string;
  helperText: string;
  imageUrl: string | null;
  onUpload: (file: File) => void;
  isUploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50">
          {imageUrl ? (
            <img src={imageUrl} alt={label} className="h-full w-full object-contain" />
          ) : (
            <Building2 className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload
          </Button>
          <p className="text-xs text-muted-foreground">{helperText}</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function BrandingSettings() {
  const { toast } = useToast();
  const { data: branding, isLoading } = useCompanyBranding();
  const updateMutation = useUpdateCompanyBranding();
  const uploadMutation = useUploadBrandingAsset();
  const [uploadingKind, setUploadingKind] = useState<"logo" | "icon" | null>(null);

  const [formData, setFormData] = useState<CompanyBranding>({
    companyName: "",
    companyAddress: "",
    logoUrl: null,
    iconUrl: null,
  });

  useEffect(() => {
    if (branding) setFormData(branding);
  }, [branding]);

  const handleUpload = (kind: "logo" | "icon", file: File) => {
    setUploadingKind(kind);
    uploadMutation.mutate(
      { file, kind },
      {
        onSuccess: (url) => {
          const updated = {
            ...formData,
            [kind === "logo" ? "logoUrl" : "iconUrl"]: url,
          };
          setFormData(updated);
          updateMutation.mutate(updated, {
            onSuccess: () =>
              toast({ title: "Uploaded", description: `${kind === "logo" ? "Logo" : "Icon"} updated.` }),
            onError: (error) =>
              toast({ title: "Error", description: error.message, variant: "destructive" }),
          });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        },
        onSettled: () => setUploadingKind(null),
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateMutation.mutateAsync(formData);
      toast({ title: "Settings saved", description: "Company branding has been updated." });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update settings",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Company Branding
        </CardTitle>
        <CardDescription>
          Shown in the sidebar and on generated payslips and PDF reports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <AssetUploader
              label="Logo"
              helperText="Used on payslips and PDF reports. PNG/JPG/SVG/WEBP, up to 2MB."
              imageUrl={formData.logoUrl}
              onUpload={(file) => handleUpload("logo", file)}
              isUploading={uploadingKind === "logo"}
            />
            <AssetUploader
              label="Icon"
              helperText="Shown in the sidebar. Square image works best, up to 2MB."
              imageUrl={formData.iconUrl}
              onUpload={(file) => handleUpload("icon", file)}
              isUploading={uploadingKind === "icon"}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
                placeholder="e.g., Acme Corporation"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyAddress">Company Address</Label>
              <Textarea
                id="companyAddress"
                value={formData.companyAddress}
                onChange={(e) => setFormData((prev) => ({ ...prev, companyAddress: e.target.value }))}
                placeholder="Street, city, state, ZIP"
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
