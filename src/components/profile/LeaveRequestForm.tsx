import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, Send, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays, subDays, startOfDay } from "date-fns";
import { useLeaveTypes, useSubmitLeaveRequest } from "@/hooks/useLeaveRequests";

interface LeaveRequestFormProps {
  employeeId: string;
}

export function LeaveRequestForm({ employeeId }: LeaveRequestFormProps) {
  const [leaveTypeId, setLeaveTypeId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState("");

  const { data: leaveTypes, isLoading: isLoadingTypes } = useLeaveTypes();
  const submitMutation = useSubmitLeaveRequest();

  const daysCount = startDate && endDate 
    ? differenceInDays(endDate, startDate) + 1 
    : 0;

  const isRetroactiveRequest = useMemo(() => {
    if (!startDate) return false;
    const today = startOfDay(new Date());
    return startDate < today;
  }, [startDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!leaveTypeId || !startDate || !endDate) return;

    const selectedLeaveType = leaveTypes?.find(t => t.id === leaveTypeId);

    await submitMutation.mutateAsync({
      employeeId,
      leaveTypeId,
      leaveTypeName: selectedLeaveType?.name || "Leave",
      startDate,
      endDate,
      reason,
    });

    // Reset form
    setLeaveTypeId("");
    setStartDate(undefined);
    setEndDate(undefined);
    setReason("");
  };

  const isValid = leaveTypeId && startDate && endDate && daysCount > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Request Time Off
        </CardTitle>
        <CardDescription>Submit a new leave request for approval</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Leave Type</Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingTypes ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : (
                  leaveTypes?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} {type.is_paid ? "(Paid)" : "(Unpaid)"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      if (date && endDate && date > endDate) {
                        setEndDate(undefined);
                      }
                    }}
                    disabled={(date) => date < subDays(new Date(), 30)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => date < (startDate || subDays(new Date(), 30))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {daysCount > 0 && (
            <p className="text-sm text-muted-foreground">
              Duration: <span className="font-medium text-foreground">{daysCount} day{daysCount !== 1 ? "s" : ""}</span>
            </p>
          )}

          {isRetroactiveRequest && (
            <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                This is a retroactive leave request for past dates. Additional approval may be required.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Reason (Optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a reason for your leave request..."
              rows={3}
            />
          </div>

          <Button type="submit" disabled={!isValid || submitMutation.isPending} className="w-full">
            {submitMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Submit Request
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
