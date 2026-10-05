import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Trash2, Download, Loader2, Eye } from "lucide-react";
import { useEmployeeDocuments, useUploadDocument, useDeleteDocument } from "@/hooks/useEmployeeDocuments";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { DocumentViewerDialog } from "./DocumentViewerDialog";
import { UPLOADABLE_DOCUMENT_TYPES, documentTypeLabel } from "./documentTypes";
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

interface EmployeeDocumentsProps {
  employeeId: string;
  canUpload?: boolean;
  canDelete?: boolean;
  /** Render without the outer card (e.g. inside a dialog that has its own title). */
  embedded?: boolean;
}

export function EmployeeDocuments({ employeeId, canUpload = true, canDelete = true, embedded = false }: EmployeeDocumentsProps) {
  const [selectedType, setSelectedType] = useState<string>("contract");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewingDocument, setViewingDocument] = useState<{
    id: string;
    document_name: string;
    document_type: string;
    file_url: string;
    uploaded_at: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documents, isLoading } = useEmployeeDocuments(employeeId);
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    await uploadMutation.mutateAsync({
      employeeId,
      file: selectedFile,
      documentType: selectedType,
    });

    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("employee-documents")
      .download(fileUrl);

    if (error) {
      console.error("Download error:", error);
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const content = (
    <div className="space-y-4">
      {canUpload && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5 sm:w-[180px]">
            <Label htmlFor={`${employeeId}-doc-type`}>Document type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger id={`${employeeId}-doc-type`} className="w-full">
                <SelectValue placeholder="Document type" />
              </SelectTrigger>
              <SelectContent>
                {UPLOADABLE_DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor={`${employeeId}-doc-file`}>File</Label>
            <Input
              id={`${employeeId}-doc-file`}
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="w-full min-w-0"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
          </div>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading documents" />
        </div>
      ) : documents && documents.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {documents.map((doc) => {
            const typeLabel = documentTypeLabel(doc.document_type);
            return (
              <li key={doc.id} className="flex items-center gap-3 p-3">
                <FileText className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium [overflow-wrap:anywhere]">{doc.document_name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-normal">{typeLabel}</Badge>
                    <span>{format(new Date(doc.uploaded_at), "MMM d, yyyy")}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 sm:h-9 sm:w-9"
                    onClick={() => setViewingDocument(doc)}
                    title="View document"
                    aria-label={`View ${doc.document_name}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 sm:h-9 sm:w-9"
                    onClick={() => handleDownload(doc.file_url, doc.document_name)}
                    title="Download document"
                    aria-label={`Download ${doc.document_name}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 sm:h-9 sm:w-9"
                          title="Delete document"
                          aria-label={`Delete ${doc.document_name}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete document?</AlertDialogTitle>
                          <AlertDialogDescription className="break-words">
                            Are you sure you want to delete "{doc.document_name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() =>
                              deleteMutation.mutate({
                                documentId: doc.id,
                                fileUrl: doc.file_url,
                                employeeId,
                              })
                            }
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          No documents uploaded yet
        </div>
      )}

      <DocumentViewerDialog
        open={!!viewingDocument}
        onOpenChange={(open) => !open && setViewingDocument(null)}
        documentInfo={viewingDocument}
      />
    </div>
  );

  if (embedded) return content;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" aria-hidden="true" />
          Documents
        </CardTitle>
        <CardDescription>
          Manage employee documents like ID proof, resumes, offer letters, and contracts
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
