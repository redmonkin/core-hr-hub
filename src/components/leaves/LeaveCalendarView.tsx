import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, CalendarDays, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  addMonths, 
  subMonths, 
  eachDayOfInterval, 
  parseISO, 
  isWithinInterval,
} from "date-fns";
import { leaveTypeBadgeClass, leaveTypeDotClass } from "./typeBadgeStyles";
import { pluralizeDays } from "@/lib/statusStyles";

interface LeaveData {
  id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  employee: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
  leave_type: {
    name: string;
  } | null;
}

export function LeaveCalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthName = format(currentDate, "MMMM yyyy");

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ["leave-calendar-view", format(monthStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select(`
          id,
          start_date,
          end_date,
          days_count,
          employee:employees!leave_requests_employee_id_fkey(
            first_name,
            last_name,
            avatar_url
          ),
          leave_type:leave_types!leave_requests_leave_type_id_fkey(name)
        `)
        .eq("status", "approved")
        .lte("start_date", format(monthEnd, "yyyy-MM-dd"))
        .gte("end_date", format(monthStart, "yyyy-MM-dd"))
        .order("start_date", { ascending: true });

      if (error) throw error;
      return (data || []) as LeaveData[];
    },
  });

  // Generate all dates that have leaves
  const leaveDates = leaves.flatMap((leave) => {
    const start = parseISO(leave.start_date);
    const end = parseISO(leave.end_date);
    return eachDayOfInterval({ start, end });
  });

  // Get leaves for selected date
  const selectedDateLeaves = selectedDate
    ? leaves.filter((leave) => {
        const start = parseISO(leave.start_date);
        const end = parseISO(leave.end_date);
        return isWithinInterval(selectedDate, { start, end });
      })
    : [];

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // Custom modifiers for calendar
  const modifiers = {
    hasLeave: leaveDates,
  };

  // Class names (not inline styles) so the selected/today states can still win over the leave tint
  const modifiersClassNames = {
    hasLeave: "bg-primary/15 font-semibold text-foreground aria-selected:bg-primary aria-selected:text-primary-foreground",
  };

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Calendar */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Leave Calendar
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handlePrevMonth} aria-label="Previous month" title="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[110px] text-center text-sm font-medium" aria-live="polite">{monthName}</span>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleNextMonth} aria-label="Next month" title="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={currentDate}
            onMonthChange={setCurrentDate}
            modifiers={modifiers}
            modifiersClassNames={modifiersClassNames}
            className="rounded-md border-0 p-0"
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
              month: "space-y-4 w-full",
              caption: "hidden",
              table: "w-full border-collapse space-y-1",
              head_row: "flex w-full",
              head_cell: "text-muted-foreground rounded-md w-full font-normal text-[0.8rem]",
              row: "flex w-full mt-2",
              cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 w-full aspect-square",
              day: "h-full w-full p-0 font-normal aria-selected:opacity-100 hover:bg-muted rounded-md transition-colors",
              day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              day_today: "ring-2 ring-primary ring-offset-2 ring-offset-background",
              day_outside: "text-muted-foreground aria-selected:text-primary-foreground",
            }}
          />
          
          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground border-t pt-4">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-primary/15 ring-1 ring-primary/30" />
              <span>Has leaves</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm ring-2 ring-primary" />
              <span>Today</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a date"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDateLeaves.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                {selectedDateLeaves.length} employee{selectedDateLeaves.length > 1 ? "s" : ""} on leave
              </p>
              {selectedDateLeaves.map((leave) => {
                const fullName = leave.employee 
                  ? `${leave.employee.first_name} ${leave.employee.last_name}` 
                  : "Unknown";
                const initials = leave.employee 
                  ? `${leave.employee.first_name[0]}${leave.employee.last_name[0]}`.toUpperCase()
                  : "??";
                const leaveType = leave.leave_type?.name || "Leave";
                
                return (
                  <div
                    key={leave.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        {leave.employee?.avatar_url && (
                          <AvatarImage src={leave.employee.avatar_url} />
                        )}
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div 
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${leaveTypeDotClass(leaveType)}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(leave.start_date), "MMM d")} - {format(parseISO(leave.end_date), "MMM d")}
                        <span className="ml-1">· {pluralizeDays(leave.days_count)}</span>
                      </p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 ${leaveTypeBadgeClass(leaveType)}`}>
                      {leaveType}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : selectedDate ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No approved leaves on this date</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click on highlighted dates to see who's out
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Select a date to view leaves</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
