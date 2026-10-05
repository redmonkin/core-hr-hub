import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Users, CalendarDays } from "lucide-react";
import { useTeamLeaves, useIsManager } from "@/hooks/useTeamLeaves";
import { Skeleton } from "@/components/ui/skeleton";
import {
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  max as maxDate,
  min as minDate,
} from "date-fns";
import { cn } from "@/lib/utils";

export function TeamLeaveCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  
  const { data: isManager, isLoading: loadingManager } = useIsManager();
  const { data: fetchedLeaves = [], isLoading } = useTeamLeaves(currentMonth);

  // Only keep leaves that actually overlap the month on screen (the query's date filter is loose).
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const teamLeaves = fetchedLeaves.filter((leave) => {
    const start = parseISO(leave.start_date);
    const end = parseISO(leave.end_date);
    return start <= monthEnd && end >= monthStart;
  });

  // Don't render if user is not a manager
  if (loadingManager) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!isManager) {
    return null;
  }

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  // Get leaves that overlap with selected date
  const selectedDateLeaves = selectedDate
    ? teamLeaves.filter((leave) => {
        const start = parseISO(leave.start_date);
        const end = parseISO(leave.end_date);
        return isWithinInterval(selectedDate, { start, end }) || 
               isSameDay(selectedDate, start) || 
               isSameDay(selectedDate, end);
      })
    : [];

  // Get all dates that have leaves
  const leaveDates = teamLeaves.flatMap((leave) => {
    const start = maxDate([parseISO(leave.start_date), monthStart]);
    const end = minDate([parseISO(leave.end_date), monthEnd]);
    return start <= end ? eachDayOfInterval({ start, end }) : [];
  });

  const modifiers = {
    hasLeave: leaveDates,
  };

  const modifiersClassNames = {
    hasLeave:
      "bg-amber-100 text-amber-900 font-semibold hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-100",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" aria-hidden="true" />
          Team calendar
        </CardTitle>
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            title="Previous month"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="text-sm font-medium" aria-live="polite">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={handleNextMonth}
            aria-label="Next month"
            title="Next month"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <Calendar
              mode="single"
              showOutsideDays={false}
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              className={cn("p-0 pointer-events-auto")}
              classNames={{
                months: "flex flex-col w-full",
                month: "space-y-2 w-full",
                caption: "hidden",
                nav: "hidden",
                table: "w-full border-collapse",
                head_row: "flex justify-between w-full",
                head_cell: "text-muted-foreground font-normal text-xs flex-1 text-center",
                row: "flex w-full mt-1 justify-between",
                cell: "flex-1 text-center text-sm p-0 relative aspect-square",
                day: "h-full w-full p-0 font-normal hover:bg-accent rounded-full flex items-center justify-center",
                day_selected: "!bg-primary !text-primary-foreground hover:!bg-primary",
                day_today: "ring-1 ring-inset ring-primary",
                day_outside: "text-muted-foreground opacity-50",
              }}
            />

            {/* Leaves for selected date */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {selectedDate ? format(selectedDate, "EEEE, MMMM d") : "Select a date"}
              </div>

              {selectedDate && selectedDateLeaves.length > 0 ? (
                <div className="space-y-2">
                  {selectedDateLeaves.map((leave) => (
                    <div
                      key={leave.id}
                      className="flex items-center gap-3 rounded-lg bg-muted/50 p-2"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={leave.employee_avatar || undefined} />
                        <AvatarFallback className="text-xs">
                          {leave.employee_name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{leave.employee_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {leave.start_date === leave.end_date
                            ? format(parseISO(leave.start_date), "MMM d")
                            : `${format(parseISO(leave.start_date), "MMM d")} – ${format(parseISO(leave.end_date), "MMM d")}`}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 whitespace-nowrap">
                        {leave.leave_type}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : selectedDate ? (
                <p className="text-sm text-muted-foreground py-2">No team members on leave</p>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  {teamLeaves.length > 0 ? (
                    <>
                      <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-amber-300 align-middle" aria-hidden="true" />
                      {`${teamLeaves.length} approved leave${teamLeaves.length !== 1 ? "s" : ""} in ${format(currentMonth, "MMMM")} — tap a highlighted day for details`}
                    </>
                  ) : (
                    `No approved leaves in ${format(currentMonth, "MMMM")}`
                  )}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
