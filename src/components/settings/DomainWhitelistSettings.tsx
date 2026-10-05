import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X, Shield, Globe } from "lucide-react";
import { z } from "zod";

interface DomainWhitelistValue {
  enabled: boolean;
  domains: string[];
}

const domainSchema = z.string()
  .trim()
  .min(1, "Domain cannot be empty")
  .regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/, "Invalid domain format (e.g., company.com)");

const DomainWhitelistSettings = () => {
  const [newDomain, setNewDomain] = useState("");
  const [domainError, setDomainError] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['domain-whitelist-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('setting_key', 'domain_whitelist')
        .maybeSingle();

      if (error) throw error;
      return data;
    }
  });

  const settingValue: DomainWhitelistValue = (settings?.setting_value as unknown as DomainWhitelistValue) || { enabled: false, domains: [] };

  const updateMutation = useMutation({
    mutationFn: async (newValue: DomainWhitelistValue) => {
      const { error } = await supabase
        .from('organization_settings')
        .upsert(
          {
            setting_key: 'domain_whitelist',
            setting_value: newValue as unknown as Record<string, never>,
          },
          { onConflict: 'setting_key' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain-whitelist-settings'] });
      toast({
        title: "Settings Updated",
        description: "Domain whitelist settings have been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
      console.error("Update error:", error);
    }
  });

  const handleToggleEnabled = (enabled: boolean) => {
    updateMutation.mutate({ ...settingValue, enabled });
  };

  const handleAddDomain = () => {
    setDomainError("");
    const result = domainSchema.safeParse(newDomain);
    
    if (!result.success) {
      setDomainError(result.error.errors[0].message);
      return;
    }

    const domainToAdd = result.data.toLowerCase();
    
    if (settingValue.domains.includes(domainToAdd)) {
      setDomainError("Domain already exists");
      return;
    }

    updateMutation.mutate({
      ...settingValue,
      domains: [...settingValue.domains, domainToAdd]
    });
    setNewDomain("");
  };

  const handleRemoveDomain = (domain: string) => {
    updateMutation.mutate({
      ...settingValue,
      domains: settingValue.domains.filter(d => d !== domain)
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Domain whitelisting</CardTitle>
          </div>
          <CardDescription>
            Control which email domains can join your organization. When enabled, only addresses on these domains can be invited or used when someone changes their email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="domain-whitelist-toggle">Enable domain whitelisting</Label>
              <p className="text-sm text-muted-foreground">
                {settingValue.enabled 
                  ? "Only whitelisted domains can register" 
                  : "Anyone can register with any email domain"}
              </p>
            </div>
            <Switch
              id="domain-whitelist-toggle"
              checked={settingValue.enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={updateMutation.isPending}
            />
          </div>

          {settingValue.enabled && (
            <>
              <div className="border-t pt-4">
                <Label htmlFor="new-domain" className="mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4" aria-hidden="true" />
                  Allowed domains
                </Label>
                
                <div className="flex gap-2 mb-4">
                  <div className="flex-1">
                    <Input
                      id="new-domain"
                      placeholder="company.com"
                      aria-invalid={!!domainError}
                      aria-describedby={domainError ? "new-domain-error" : undefined}
                      value={newDomain}
                      onChange={(e) => {
                        setNewDomain(e.target.value);
                        setDomainError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddDomain();
                        }
                      }}
                      disabled={updateMutation.isPending}
                    />
                    {domainError && (
                      <p id="new-domain-error" className="mt-1 text-sm text-destructive">{domainError}</p>
                    )}
                  </div>
                  <Button 
                    onClick={handleAddDomain} 
                    disabled={updateMutation.isPending || !newDomain.trim()}
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {settingValue.domains.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No domains added yet. Add at least one domain to enable registration.
                    </p>
                  ) : (
                    settingValue.domains.map((domain) => (
                      <Badge key={domain} variant="secondary" className="gap-1 py-0 pl-3 pr-0 text-sm font-normal">
                        {domain}
                        <button
                          type="button"
                          onClick={() => handleRemoveDomain(domain)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-destructive/20 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                          disabled={updateMutation.isPending}
                          aria-label={`Remove ${domain}`}
                          title={`Remove ${domain}`}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {settingValue.enabled && settingValue.domains.length === 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="text-sm text-destructive">
                    ⚠️ No domains added yet. The whitelist has no effect until you add at least one domain.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DomainWhitelistSettings;
