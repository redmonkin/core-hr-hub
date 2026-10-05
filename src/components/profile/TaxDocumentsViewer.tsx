import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileText, Files, Eye } from "lucide-react";
import { format } from "date-fns";
import { DocumentViewerDialog } from "@/components/documents/DocumentViewerDialog";
import {
  TAX_DOCUMENT_TYPES,
  TAX_DOCUMENT_TYPE_VALUES,
  documentTypeLabel,
} from "@/components/documents/documentTypes";

interface TaxDocumentsViewerProps {
  employeeId: string;
}

export function TaxDocumentsViewer({ employeeId }: TaxDocumentsViewerProps) {
  const [viewingDocument, setViewingDocument] = useState<{
    id: string;
    document_name: string;
    document_type: string;
    file_url: string;
    uploaded_at: string;
  } | null>(null);

  // Fetch tax-related documents for the employee
  const { data: documents, isLoading } = useQuery({
    queryKey: ["my-tax-documents", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("employee_id", employeeId)
        .in("document_type", TAX_DOCUMENT_TYPE_VALUES)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      // Extract the path from the full URL if needed
      const pathMatch = fileUrl.match(/employee-documents\/(.+)/);
      const filePath = pathMatch ? pathMatch[1] : fileUrl;

      const { data, error } = await supabase.storage
        .from("employee-documents")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Files className="h-5 w-5 text-primary" aria-hidden="true" />
          Tax documents
        </CardTitle>
        <CardDescription>Download your Form 16 and other tax documents</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : documents && documents.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="break-words font-medium [overflow-wrap:anywhere]">{doc.document_name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-normal">{documentTypeLabel(doc.document_type)}</Badge>
                      <span>{format(new Date(doc.uploaded_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 pl-7 sm:pl-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => setViewingDocument(doc)}
                    aria-label={`View ${doc.document_name}`}
                  >
                    <Eye className="mr-1 h-4 w-4" aria-hidden="true" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => handleDownload(doc.file_url, doc.document_name)}
                    aria-label={`Download ${doc.document_name}`}
                  >
                    <Download className="mr-1 h-4 w-4" aria-hidden="true" />
                    Download
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Files className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <p className="text-lg font-medium">No tax documents yet</p>
            <p className="text-sm text-muted-foreground">
              Your Form 16 and other tax documents will appear here once HR uploads them.
            </p>
          </div>
        )}

        {/* Document types legend */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">Document types:</span>
          {TAX_DOCUMENT_TYPES.map((type) => (
            <Badge key={type.value} variant="outline" className="font-normal text-muted-foreground">
              {type.label}
            </Badge>
          ))}
        </div>

        <DocumentViewerDialog
          open={!!viewingDocument}
          onOpenChange={(open) => !open && setViewingDocument(null)}
          documentInfo={viewingDocument}
        />
      </CardContent>
    </Card>
  );
}
