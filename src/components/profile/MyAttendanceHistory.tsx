import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusBadgeClass, formatStatus } from "@/lib/statusStyles";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, MapPin, CalendarDays, Coffee } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateTotalBreakHours, AttendanceBreak } from "@/hooks/useAttendanceBreaks";

interface MyAttendanceHistoryProps {
  employeeId: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number | null;
  status: string;
  work_mode: string | null;
  clock_in_location_name: string | null;
  clock_out_location_name: string | null;
}

export function MyAttendanceHistory({ employeeId }: MyAttendanceHistoryProps) {
  const { data: records, isLoading } = useQuery({
    queryKey: ["my-attendance-history", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, date, clock_in, clock_out, total_hours, status, work_mode, clock_in_location_name, clock_out_location_name")
        .eq("employee_id", employeeId)
        .order("date", { ascending: false })
        .limit(30);

      if (error) throw error;
      return data as AttendanceRecord[];
    },
    enabled: !!employeeId,
  });

  // Fetch breaks for all records
  const recordIds = records?.map(r => r.id) || [];
  const { data: allBreaks } = useQuery({
    queryKey: ["my-attendance-breaks", recordIds],
    queryFn: async () => {
      if (recordIds.length === 0) return [];
      const { data, error } = await supabase
        .from("attendance_breaks")
        .select("*")
        .in("attendance_record_id", recordIds);
      if (error) throw error;
      return (data || []) as AttendanceBreak[];
    },
    enabled: recordIds.length > 0,
  });

  const getBreaksForRecord = (recordId: string) => {
    return (allBreaks || []).filter(b => b.attendance_record_id === recordId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Attendance History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "-";
    return format(new Date(timestamp), "h:mm a");
  };

  const formatHours = (hours: number | null) => {
    if (hours === null) return "-";
    return `${hours.toFixed(1)}h`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" aria-hidden="true" />
          Attendance history
        </CardTitle>
        <CardDescription>Your recent attendance records (last 30 days)</CardDescription>
      </CardHeader>
      <CardContent>
        {records && records.length > 0 ? (
          <>
          <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Breaks</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(record.date), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1">
                            {formatTime(record.clock_in)}
                            {record.clock_in_location_name && (
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                            )}
                          </TooltipTrigger>
                          {record.clock_in_location_name && (
                            <TooltipContent>
                              <p>{record.clock_in_location_name}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1">
                            {formatTime(record.clock_out)}
                            {record.clock_out_location_name && (
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                            )}
                          </TooltipTrigger>
                          {record.clock_out_location_name && (
                            <TooltipContent>
                              <p>{record.clock_out_location_name}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const breaks = getBreaksForRecord(record.id);
                        if (breaks.length === 0) return "-";
                        const totalHrs = calculateTotalBreakHours(breaks);
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="text-xs">
                                  <Coffee className="h-3 w-3 mr-1" />
                                  {breaks.length} · {totalHrs.toFixed(1)}h
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{breaks.length} break{breaks.length > 1 ? 's' : ''}, {totalHrs.toFixed(1)}h total</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}
                    </TableCell>
                    <TableCell>{formatHours(record.total_hours)}</TableCell>
                    <TableCell>
                      {record.work_mode ? (
                        <Badge variant="outline" className="text-xs">
                          {record.work_mode === "wfh" ? "WFH" : "Office"}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass(record.status)}>
                        {formatStatus(record.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-2 sm:hidden">
            {records.map((record) => {
              const breaks = getBreaksForRecord(record.id);
              return (
                <li key={record.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{format(new Date(record.date), "EEE, MMM d, yyyy")}</p>
                    <Badge variant="outline" className={statusBadgeClass(record.status)}>
                      {formatStatus(record.status)}
                    </Badge>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">In / out</dt>
                    <dd className="text-right">{formatTime(record.clock_in)} – {formatTime(record.clock_out)}</dd>
                    <dt className="text-muted-foreground">Hours</dt>
                    <dd className="text-right">{formatHours(record.total_hours)}</dd>
                    {breaks.length > 0 && (
                      <>
                        <dt className="text-muted-foreground">Breaks</dt>
                        <dd className="text-right">
                          {breaks.length} · {calculateTotalBreakHours(breaks).toFixed(1)}h
                        </dd>
                      </>
                    )}
                    {record.work_mode && (
                      <>
                        <dt className="text-muted-foreground">Mode</dt>
                        <dd className="text-right">{record.work_mode === "wfh" ? "WFH" : "Office"}</dd>
                      </>
                    )}
                  </dl>
                  {(record.clock_in_location_name || record.clock_out_location_name) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {record.clock_in_location_name || record.clock_out_location_name}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No attendance records yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
