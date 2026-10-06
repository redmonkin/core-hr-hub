import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type ChecklistSection, useOffboardingChecklist, useSaveOffboardingChecklist } from "@/hooks/useOffboarding";

interface ChecklistTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Edit the department-wise offboarding checklist that goes into every offboarding email. */
export function ChecklistTemplateDialog({ open, onOpenChange }: ChecklistTemplateDialogProps) {
  const { data: saved = [] } = useOffboardingChecklist();
  const save = useSaveOffboardingChecklist();
  const [sections, setSections] = useState<ChecklistSection[]>([]);

  useEffect(() => {
    if (open) setSections(saved.map((s) => ({ name: s.name, items: [...s.items] })));
  }, [open, saved]);

  const update = (index: number, change: Partial<ChecklistSection>) =>
    setSections((all) => all.map((s, i) => (i === index ? { ...s, ...change } : s)));

  const move = (index: number, by: -1 | 1) =>
    setSections((all) => {
      const next = [...all];
      const target = index + by;
      if (target < 0 || target >= next.length) return all;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const submit = () =>
    save.mutate(sections, {
      onSuccess: () => {
        toast.success("Checklist saved", { description: "New offboarding emails will use it." });
        onOpenChange(false);
      },
      onError: (e: Error) => toast.error("Couldn't save the checklist", { description: e.message }),
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Offboarding checklist</DialogTitle>
          <DialogDescription>
            Grouped by department. It's included in every offboarding email and the last-day reminder. Empty items and
            sections without items are left out.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-4">
          {sections.map((section, si) => (
            <li key={si} className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[12rem] flex-1 space-y-1.5">
                  <Label htmlFor={`section-${si}`}>Department</Label>
                  <Input
                    id={`section-${si}`}
                    value={section.name}
                    onChange={(e) => update(si, { name: e.target.value })}
                    placeholder="e.g. IT Department"
                    maxLength={80}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => move(si, -1)}
                  disabled={si === 0}
                  aria-label={`Move ${section.name || "section"} up`}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => move(si, 1)}
                  disabled={si === sections.length - 1}
                  aria-label={`Move ${section.name || "section"} down`}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => setSections((all) => all.filter((_, i) => i !== si))}
                  aria-label={`Remove ${section.name || "section"}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              <ul className="space-y-2" aria-label={`Items for ${section.name || "this department"}`}>
                {section.items.map((item, ii) => (
                  <li key={ii} className="flex gap-2">
                    <Label htmlFor={`item-${si}-${ii}`} className="sr-only">
                      Item {ii + 1}
                    </Label>
                    <Textarea
                      id={`item-${si}-${ii}`}
                      value={item}
                      onChange={(e) =>
                        update(si, { items: section.items.map((x, j) => (j === ii ? e.target.value : x)) })
                      }
                      maxLength={300}
                      rows={2}
                      className="min-h-0 resize-y"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => update(si, { items: section.items.filter((_, j) => j !== ii) })}
                      aria-label={`Remove item ${ii + 1}`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => update(si, { items: [...section.items, ""] })}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Add item
              </Button>
            </li>
          ))}
        </ol>

        <Button
          type="button"
          variant="outline"
          onClick={() => setSections((all) => [...all, { name: "", items: [""] }])}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add department
        </Button>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save checklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
