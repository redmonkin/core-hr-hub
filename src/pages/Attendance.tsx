import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, LogIn, LogOut, Calendar, Briefcase, Timer, AlertTriangle, MapPin, Loader2, Home, Building2, Pause, Play, Coffee } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { useSorting } from "@/hooks/useSorting";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { useAttendance, useTodayAttendance, useClockIn, useClockOut, useAttendanceReport, LocationData, WorkMode } from "@/hooks/useAttendance";
import { useIsAdminOrHR } from "@/hooks/useUserRole";
import { useActiveBreak, useBreaksForRecord, usePause, useResume, calculateTotalBreakHours } from "@/hooks/useAttendanceBreaks";
import { useOfficeLocation, getDistanceMeters } from "@/components/settings/OfficeLocationSettings";
import { getExpectedHours, getShiftEndTime } from "@/lib/shiftUtils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const MONTHS = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

function getStatusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    present: "default",
    late: "secondary",
    absent: "destructive",
    "half-day": "outline",
  };
  return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
}

const Attendance = () => {
  const { user } = useAuth();
  const { isAdminOrHR } = useIsAdminOrHR();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [workMode, setWorkMode] = useState<WorkMode>('wfo');
  const [showEarlyClockOutWarning, setShowEarlyClockOutWarning] = useState(false);
  const [earlyClockOutReasons, setEarlyClockOutReasons] = useState<{ beforeEndTime: boolean; insufficientHours: boolean }>({ beforeEndTime: false, insufficientHours: false });
  const [showLateClockOutDialog, setShowLateClockOutDialog] = useState(false);
  const [lateClockOutMode, setLateClockOutMode] = useState<"overtime" | "missed" | null>(null);
  const [missedClockOutTime, setMissedClockOutTime] = useState("");
  

  const targetDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1);

  // Get current employee with working schedule - fetch first
  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, working_hours_start, working_hours_end, working_days")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Now fetch today's attendance for the current employee specifically
  const { data: todayRecord, isLoading: todayLoading } = useTodayAttendance(currentEmployee?.id);
  const { data: attendanceRecords, isLoading: recordsLoading } = useAttendance(targetDate, currentEmployee?.id);
  const { data: reportData, isLoading: reportLoading } = useAttendanceReport(targetDate);
  const { data: activeBreak } = useActiveBreak(todayRecord?.id);
  const { data: todayBreaks } = useBreaksForRecord(todayRecord?.id);
  const { data: officeLocation } = useOfficeLocation();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const pauseMutation = usePause();
  const resumeMutation = useResume();
  // Format time for display (e.g., "09:00:00" -> "9:00 AM")
  const formatTimeDisplay = (time: string | null): string => {
    if (!time) return "--:--";
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  // Get day names for working days
  const getDayNames = (days: number[] | null): string => {
    if (!days || days.length === 0) return "Not set";
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.sort((a, b) => a - b).map(d => dayNames[d]).join(', ');
  };

  // Check if today is a working day
  const isWorkingDay = (days: number[] | null): boolean => {
    const today = new Date().getDay();
    return (days || [1, 2, 3, 4, 5]).includes(today);
  };

  // Calculate overtime for a record based on the record's employee schedule
  const calculateOvertime = (record: { clock_in: string | null; clock_out: string | null; total_hours: number | null; employee?: { working_hours_start: string | null; working_hours_end: string | null } }): number => {
    if (!record.clock_out || !record.total_hours) return 0;
    
    const workStart = record.employee?.working_hours_start || currentEmployee?.working_hours_start || "09:00:00";
    const workEnd = record.employee?.working_hours_end || currentEmployee?.working_hours_end || "18:00:00";
    
    // Calculate expected hours accounting for cross-midnight shifts
    const expectedHours = getExpectedHours(workStart, workEnd);
    
    // Overtime is hours worked beyond expected hours
    const overtime = record.total_hours - expectedHours;
    return overtime > 0 ? overtime : 0;
  };

  // Calculate total overtime for the month
  const calculateMonthlyOvertime = (): number => {
    if (!attendanceRecords) return 0;
    return attendanceRecords.reduce((total, record) => total + calculateOvertime(record), 0);
  };

  // Calculate late arrival in minutes using the record's employee schedule
  const calculateLateArrival = (clockIn: string | null, employeeSchedule?: { working_hours_start: string | null; working_hours_end: string | null }): number => {
    if (!clockIn) return 0;
    
    const workStart = employeeSchedule?.working_hours_start || currentEmployee?.working_hours_start || "09:00:00";
    const [startHour, startMin] = workStart.split(':').map(Number);
    
    const clockInDate = new Date(clockIn);
    const clockInHour = clockInDate.getHours();
    const clockInMinute = clockInDate.getMinutes();
    
    // Calculate minutes late (1-minute grace period to account for seconds)
    const scheduledMinutes = startHour * 60 + startMin;
    const actualMinutes = clockInHour * 60 + clockInMinute;
    const lateMinutes = actualMinutes - scheduledMinutes;
    
    return lateMinutes > 1 ? lateMinutes : 0;
  };

  // Format late duration for display
  const formatLateDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Count late arrivals for the month
  const countLateArrivals = (): number => {
    if (!attendanceRecords) return 0;
    return attendanceRecords.filter(record => calculateLateArrival(record.clock_in, record.employee) > 0).length;
  };

  // Sorting for attendance history
  const historySorting = useSorting(attendanceRecords || []);
  
  // Pagination for attendance history (uses sorted items)
  const historyPagination = usePagination(historySorting.sortedItems, { initialPageSize: 10 });

  // Get current location
  const getCurrentLocation = (): Promise<LocationData | undefined> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast.error("Geolocation is not supported by your browser");
        resolve(undefined);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Try to get location name via reverse geocoding
          let locationName: string | undefined;
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
            );
            const data = await response.json();
            if (data.address) {
              // Build a readable address with city
              const addr = data.address;
              const parts: string[] = [];
              
              // Add street-level detail
              if (addr.road) parts.push(addr.road);
              else if (addr.neighbourhood) parts.push(addr.neighbourhood);
              else if (addr.suburb) parts.push(addr.suburb);
              
              // Add area/locality
              if (addr.suburb && !parts.includes(addr.suburb)) parts.push(addr.suburb);
              else if (addr.neighbourhood && !parts.includes(addr.neighbourhood)) parts.push(addr.neighbourhood);
              
              // Add city
              const city = addr.city || addr.town || addr.village || addr.municipality || addr.county;
              if (city) parts.push(city);
              
              // Add state if different from city
              if (addr.state && addr.state !== city) parts.push(addr.state);
              
              locationName = parts.slice(0, 4).join(", ");
            } else if (data.display_name) {
              // Fallback to display_name
              const parts = data.display_name.split(", ");
              locationName = parts.slice(0, 4).join(", ");
            }
          } catch (error) {
            console.error("Failed to get location name:", error);
          }

          resolve({ latitude, longitude, locationName });
        },
        (error) => {
          console.error("Geolocation error:", error);
          switch (error.code) {
            case error.PERMISSION_DENIED:
              toast.error("Location access is required to clock in. Please enable location permissions in your browser settings and try again.");
              break;
            case error.POSITION_UNAVAILABLE:
              toast.error("Location information is unavailable. Clock-in requires location access.");
              break;
            case error.TIMEOUT:
              toast.error("Location request timed out. Please try again.");
              break;
            default:
              toast.error("Failed to get location. Clock-in requires location access.");
          }
          resolve(undefined);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  const handleClockIn = async (mode: WorkMode) => {
    if (!currentEmployee) {
      toast.error("Employee profile not found");
      return;
    }

    try {
      toast.info("Getting your location...");
      const location = await getCurrentLocation();

      // For WFO, location is mandatory; for WFH it's optional
      if (mode === 'wfo' && !location) {
        toast.error("Location is required to clock in from office");
        return;
      }

      // Auto-detect work mode only when location is available and office is configured
      let detectedMode = mode;
      if (location && officeLocation?.latitude && officeLocation?.longitude) {
        const distance = getDistanceMeters(
          location.latitude, location.longitude,
          officeLocation.latitude, officeLocation.longitude
        );
        const radius = officeLocation.radius_meters || 500;
        detectedMode = distance <= radius ? 'wfo' : 'wfh';

        // If user chose WFO but is outside office radius, block it
        if (mode === 'wfo' && detectedMode === 'wfh') {
          toast.error(`You are not at the office location (${Math.round(distance)}m away). Please choose Work From Home instead.`);
          return;
        }
      }

      await clockIn.mutateAsync({ employeeId: currentEmployee.id, location, workMode: detectedMode });
      const modeLabel = detectedMode === 'wfh' ? 'Work From Home' : 'Work From Office';
      toast.success(location ? `Clocked in (${modeLabel}) with location` : `Clocked in (${modeLabel})`);
    } catch (error) {
      toast.error("Failed to clock in");
    }
  };

  // Calculate current hours worked for early clock-out warning
  const calculateCurrentHoursWorked = (): number => {
    if (!todayRecord?.clock_in) return 0;
    const clockInTime = new Date(todayRecord.clock_in);
    const now = new Date();
    return (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
  };

  // Check if current time is before scheduled end time (handles cross-midnight shifts)
  const isBeforeEndTime = (): boolean => {
    if (!currentEmployee?.working_hours_end || !currentEmployee?.working_hours_start || !todayRecord?.clock_in) return false;
    const clockInTime = new Date(todayRecord.clock_in);
    const endTime = getShiftEndTime(clockInTime, currentEmployee.working_hours_start, currentEmployee.working_hours_end);
    return new Date() < endTime;
  };

  const handleClockOutAttempt = () => {
    if (!todayRecord || !todayRecord.clock_in) {
      toast.error("No active clock-in found");
      return;
    }

    const hoursWorked = calculateCurrentHoursWorked();
    const workStart = currentEmployee?.working_hours_start || "09:00:00";
    const workEnd = currentEmployee?.working_hours_end || "18:00:00";
    const requiredHours = getExpectedHours(workStart, workEnd);
    const beforeEndTime = isBeforeEndTime();
    const insufficientHours = hoursWorked < requiredHours;

    if (beforeEndTime || insufficientHours) {
      setEarlyClockOutReasons({ beforeEndTime, insufficientHours });
      setShowEarlyClockOutWarning(true);
    } else {
      // Past end time — check if overtime or missed clock-out
      const isAfterEndTime = !isBeforeEndTime();
      if (isAfterEndTime && hoursWorked > requiredHours) {
        setLateClockOutMode(null);
        setMissedClockOutTime(workEnd.substring(0, 5));
        setShowLateClockOutDialog(true);
      } else {
        handleClockOut();
      }
    }
  };

  const handleLateClockOutConfirm = async () => {
    if (!todayRecord || !todayRecord.clock_in) return;
    setShowLateClockOutDialog(false);

    if (lateClockOutMode === "overtime") {
      handleClockOut();
    } else if (lateClockOutMode === "missed" && missedClockOutTime) {
      try {
        toast.info("Getting your location...");
        const location = await getCurrentLocation();
        
        // Build clock-out date from today's date + entered time
        const [hours, minutes] = missedClockOutTime.split(":").map(Number);
        const customTime = new Date(todayRecord.clock_in);
        customTime.setHours(hours, minutes, 0, 0);
        
        // If custom time is before clock-in, it might be next day (cross-midnight)
        if (customTime <= new Date(todayRecord.clock_in)) {
          customTime.setDate(customTime.getDate() + 1);
        }
        
        await clockOut.mutateAsync({ recordId: todayRecord.id, clockIn: todayRecord.clock_in, location, customClockOut: customTime });
        toast.success("Clocked out with corrected time");
      } catch (error) {
        toast.error("Failed to clock out");
      }
    }
  };

  const handleClockOut = async () => {
    if (!todayRecord || !todayRecord.clock_in) {
      toast.error("No active clock-in found");
      return;
    }

    setShowEarlyClockOutWarning(false);

    try {
      toast.info("Getting your location...");
      const location = await getCurrentLocation();
      await clockOut.mutateAsync({ recordId: todayRecord.id, clockIn: todayRecord.clock_in, location });
      toast.success(location ? "Clocked out with location" : "Clocked out successfully");
    } catch (error) {
      toast.error("Failed to clock out");
    }
  };

  // Format hours for display in warning
  const formatHoursWorked = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const handlePause = async () => {
    if (!todayRecord) return;
    try {
      toast.info("Getting your location...");
      const location = await getCurrentLocation();
      if (!location) return;
      await pauseMutation.mutateAsync({ attendanceRecordId: todayRecord.id, location });
      toast.success("Work paused — break started");
    } catch (error) {
      toast.error("Failed to pause");
    }
  };

  const handleResume = async () => {
    if (!activeBreak) return;
    try {
      toast.info("Getting your location...");
      const location = await getCurrentLocation();
      if (!location) return;
      await resumeMutation.mutateAsync({ breakId: activeBreak.id, location });
      toast.success("Work resumed");
    } catch (error) {
      toast.error("Failed to resume");
    }
  };

  const totalBreakHours = todayBreaks ? calculateTotalBreakHours(todayBreaks) : 0;
  const isPaused = !!activeBreak;

  const currentTime = new Date();
  const isClockedIn = todayRecord?.clock_in && !todayRecord?.clock_out;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Attendance</h2>
            <p className="text-muted-foreground">Track your daily attendance and view history</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Clock In/Out Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Today's Attendance
            </CardTitle>
            <CardDescription>{format(currentTime, "EEEE, MMMM d, yyyy")}</CardDescription>
          </CardHeader>
          <CardContent>
            {todayLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="flex flex-col gap-2 text-center sm:text-left">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div>
                        <p className="text-sm text-muted-foreground">Clock In</p>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold">
                            {todayRecord?.clock_in
                              ? format(new Date(todayRecord.clock_in), "hh:mm a")
                              : "--:--"}
                          </p>
                          {isAdminOrHR && todayRecord?.clock_in && calculateLateArrival(todayRecord.clock_in) > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {formatLateDuration(calculateLateArrival(todayRecord.clock_in))} late
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Clock Out</p>
                        <p className="text-lg font-semibold">
                          {todayRecord?.clock_out
                            ? format(new Date(todayRecord.clock_out), "hh:mm a")
                            : "--:--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Hours</p>
                        <p className="text-lg font-semibold">
                          {todayRecord?.total_hours
                            ? `${todayRecord.total_hours.toFixed(2)} hrs`
                            : "--"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 items-center sm:items-end">
                    {!isClockedIn && !todayRecord?.clock_out && (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground text-center sm:text-right">Select work mode:</p>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleClockIn('wfo')} 
                            disabled={clockIn.isPending}
                            variant="default"
                          >
                            {clockIn.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Building2 className="mr-2 h-4 w-4" />
                            )}
                            Office
                          </Button>
                          <Button 
                            onClick={() => handleClockIn('wfh')} 
                            disabled={clockIn.isPending}
                            variant="secondary"
                          >
                            {clockIn.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Home className="mr-2 h-4 w-4" />
                            )}
                            Home
                          </Button>
                        </div>
                      </div>
                    )}
                    {isClockedIn && (
                      <div className="flex flex-col gap-2 items-center sm:items-end">
                        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
                          {todayRecord?.work_mode && (
                            <Badge variant={todayRecord.work_mode === 'wfo' ? 'default' : 'secondary'}>
                              {todayRecord.work_mode === 'wfo' ? (
                                <><Building2 className="h-3 w-3 mr-1" /> Office</>
                              ) : (
                                <><Home className="h-3 w-3 mr-1" /> Home</>
                              )}
                            </Badge>
                          )}
                          {isPaused ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                              <Coffee className="h-3 w-3 mr-1" /> On Break
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {isPaused ? (
                            <Button onClick={handleResume} variant="default" disabled={resumeMutation.isPending}>
                              {resumeMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="mr-2 h-4 w-4" />
                              )}
                              Resume
                            </Button>
                          ) : (
                            <>
                              <Button onClick={handlePause} variant="secondary" disabled={pauseMutation.isPending}>
                                {pauseMutation.isPending ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Pause className="mr-2 h-4 w-4" />
                                )}
                                Pause
                              </Button>
                              <Button onClick={handleClockOutAttempt} variant="outline" disabled={clockOut.isPending}>
                                {clockOut.isPending ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <LogOut className="mr-2 h-4 w-4" />
                                )}
                                Clock Out
                              </Button>
                            </>
                          )}
                        </div>
                        {todayBreaks && todayBreaks.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {todayBreaks.length} break{todayBreaks.length > 1 ? 's' : ''} · {totalBreakHours.toFixed(1)}h total
                          </p>
                        )}
                      </div>
                    )}
                    {todayRecord?.clock_out && (
                      <div className="flex items-center gap-2">
                        {todayRecord?.work_mode && (
                          <Badge variant={todayRecord.work_mode === 'wfo' ? 'default' : 'secondary'}>
                            {todayRecord.work_mode === 'wfo' ? (
                              <><Building2 className="h-3 w-3 mr-1" /> Office</>
                            ) : (
                              <><Home className="h-3 w-3 mr-1" /> Home</>
                            )}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-sm">
                          Completed for today
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Location Display */}
                {(todayRecord?.clock_in_location_name || todayRecord?.clock_out_location_name) && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-border">
                    {todayRecord?.clock_in_location_name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        <span>Clock In:</span>
                        <span className="text-foreground">{todayRecord.clock_in_location_name}</span>
                      </div>
                    )}
                    {todayRecord?.clock_out_location_name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        <span>Clock Out:</span>
                        <span className="text-foreground">{todayRecord.clock_out_location_name}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Working Schedule Card */}
        {currentEmployee && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                My Working Schedule
              </CardTitle>
              <CardDescription>Your configured work hours and days for attendance reminders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid grid-cols-2 gap-6 sm:flex sm:gap-8">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Time</p>
                    <p className="text-lg font-semibold">
                      {formatTimeDisplay(currentEmployee.working_hours_start)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Time</p>
                    <p className="text-lg font-semibold">
                      {formatTimeDisplay(currentEmployee.working_hours_end)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Working Days</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                        const workingDays = currentEmployee.working_days || [1, 2, 3, 4, 5];
                        const isActive = workingDays.includes(index);
                        const isToday = new Date().getDay() === index;
                        return (
                          <Badge 
                            key={day} 
                            variant={isActive ? "default" : "outline"}
                            className={`${isToday ? 'ring-2 ring-primary ring-offset-2' : ''} ${!isActive ? 'opacity-50' : ''}`}
                          >
                            {day}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  {isWorkingDay(currentEmployee.working_days) ? (
                    <Badge variant="default" className="bg-green-600">Working Day</Badge>
                  ) : (
                    <Badge variant="secondary">Day Off</Badge>
                  )}
                  <a href="/profile" className="text-sm text-primary hover:underline">
                    Edit Schedule →
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* My Monthly Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>My Monthly Summary</CardTitle>
                <CardDescription>
                  {MONTHS[parseInt(selectedMonth)].label} {selectedYear}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {reportLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (() => {
              const myData = reportData?.find((emp) => emp.employeeId === currentEmployee?.id);
              if (!myData) {
                return (
                  <div className="flex h-24 items-center justify-center text-muted-foreground">
                    No attendance records for this month
                  </div>
                );
              }
              return (
                <div className="grid gap-4 sm:grid-cols-5">
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Present Days</p>
                    <p className="text-2xl font-bold">{myData.presentDays}</p>
                  </div>
                  <div className="rounded-lg border bg-primary/10 p-4">
                    <p className="text-sm text-muted-foreground">From Office</p>
                    <p className="text-2xl font-bold text-primary">{myData.wfoDays}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Total Hours</p>
                    <p className="text-2xl font-bold">{myData.totalHours.toFixed(1)}h</p>
                  </div>
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Avg Hours/Day</p>
                    <p className="text-2xl font-bold">
                      {myData.totalDays > 0 ? (myData.totalHours / myData.totalDays).toFixed(1) : "0"}h
                    </p>
                  </div>
                  {isAdminOrHR && (
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <p className="text-sm text-muted-foreground">Late Arrivals</p>
                      <p className="text-2xl font-bold">{myData.lateDays}</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* My Attendance History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>My Attendance History</CardTitle>
              <CardDescription>Your attendance records for {MONTHS[parseInt(selectedMonth)].label}</CardDescription>
            </div>
            {attendanceRecords && attendanceRecords.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                {isAdminOrHR && countLateArrivals() > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 border border-red-100">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">Late Arrivals: </span>
                      <span className="font-semibold text-red-600">{countLateArrivals()}</span>
                    </div>
                  </div>
                )}
                {isAdminOrHR && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                    <Timer className="h-4 w-4 text-orange-500" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">Overtime: </span>
                      <span className="font-semibold text-orange-600">{calculateMonthlyOvertime().toFixed(2)} hrs</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : attendanceRecords && attendanceRecords.length > 0 ? (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        sortKey="date"
                        currentSortKey={historySorting.sortConfig.key as string | null}
                        direction={historySorting.sortConfig.key === "date" ? historySorting.sortConfig.direction : null}
                        onSort={(key) => historySorting.requestSort(key as keyof typeof historySorting.sortedItems[0])}
                      >
                        Date
                      </SortableTableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <SortableTableHead
                        sortKey="total_hours"
                        currentSortKey={historySorting.sortConfig.key as string | null}
                        direction={historySorting.sortConfig.key === "total_hours" ? historySorting.sortConfig.direction : null}
                        onSort={(key) => historySorting.requestSort(key as keyof typeof historySorting.sortedItems[0])}
                      >
                        Total Hours
                      </SortableTableHead>
                      {isAdminOrHR && <TableHead>Overtime</TableHead>}
                      <TableHead>Mode</TableHead>
                      <TableHead>Location</TableHead>
                      <SortableTableHead
                        sortKey="status"
                        currentSortKey={historySorting.sortConfig.key as string | null}
                        direction={historySorting.sortConfig.key === "status" ? historySorting.sortConfig.direction : null}
                        onSort={(key) => historySorting.requestSort(key as keyof typeof historySorting.sortedItems[0])}
                      >
                        Status
                      </SortableTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyPagination.paginatedItems.map((record) => {
                      const overtime = calculateOvertime(record);
                      const lateMinutes = calculateLateArrival(record.clock_in, record.employee);
                      return (
                        <TableRow key={record.id}>
                          <TableCell>{format(new Date(record.date), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {record.employee 
                                  ? `${record.employee.first_name} ${record.employee.last_name}` 
                                  : "-"}
                              </span>
                              {record.employee?.employee_code && (
                                <span className="text-xs text-muted-foreground">{record.employee.employee_code}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {record.clock_in ? format(new Date(record.clock_in), "hh:mm a") : "-"}
                              {isAdminOrHR && lateMinutes > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {formatLateDuration(lateMinutes)} late
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {record.clock_out ? format(new Date(record.clock_out), "hh:mm a") : "-"}
                          </TableCell>
                          <TableCell>
                            {record.total_hours ? `${record.total_hours.toFixed(2)} hrs` : "-"}
                          </TableCell>
                          {isAdminOrHR && (
                            <TableCell>
                              {overtime > 0 ? (
                                <Badge variant="secondary" className="text-xs">
                                  +{overtime.toFixed(2)} hrs
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            {record.work_mode ? (
                              <Badge variant={record.work_mode === 'wfo' ? 'default' : 'secondary'} className="text-xs">
                                {record.work_mode === 'wfo' ? (
                                  <><Building2 className="h-3 w-3 mr-1" /> Office</>
                                ) : (
                                  <><Home className="h-3 w-3 mr-1" /> Home</>
                                )}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {(record.clock_in_location_name || record.clock_out_location_name) ? (
                              <TooltipProvider>
                                <div className="flex flex-col gap-1 max-w-[200px]">
                                  {record.clock_in_location_name && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-start gap-1.5 text-xs cursor-help">
                                          <MapPin className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                                          <span className="text-muted-foreground truncate">
                                            In: {record.clock_in_location_name}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-[300px]">
                                        <p className="text-sm font-medium">Clock In Location</p>
                                        <p className="text-xs text-muted-foreground">{record.clock_in_location_name}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {record.clock_out_location_name && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-start gap-1.5 text-xs cursor-help">
                                          <MapPin className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                                          <span className="text-muted-foreground truncate">
                                            Out: {record.clock_out_location_name}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-[300px]">
                                        <p className="text-sm font-medium">Clock Out Location</p>
                                        <p className="text-xs text-muted-foreground">{record.clock_out_location_name}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TooltipProvider>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination for history */}
              {historyPagination.totalPages > 1 && (
                <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Show</span>
                    <Select value={historyPagination.pageSize.toString()} onValueChange={(v) => historyPagination.setPageSize(Number(v))}>
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 20, 50].map((size) => (
                          <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>of {historyPagination.totalItems} records</span>
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => historyPagination.canGoPrevious && historyPagination.goToPreviousPage()}
                          className={!historyPagination.canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {(() => {
                        const pages: (number | "ellipsis")[] = [];
                        const { currentPage, totalPages } = historyPagination;
                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          pages.push(1);
                          if (currentPage > 3) pages.push("ellipsis");
                          for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                            pages.push(i);
                          }
                          if (currentPage < totalPages - 2) pages.push("ellipsis");
                          pages.push(totalPages);
                        }
                        return pages.map((page, idx) =>
                          page === "ellipsis" ? (
                            <PaginationItem key={`ellipsis-${idx}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => historyPagination.setPage(page)}
                                isActive={historyPagination.currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        );
                      })()}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => historyPagination.canGoNext && historyPagination.goToNextPage()}
                          className={!historyPagination.canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
              </>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                No attendance records found
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Early Clock-Out Warning Dialog */}
      <AlertDialog open={showEarlyClockOutWarning} onOpenChange={setShowEarlyClockOutWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Early Clock-Out Warning
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {earlyClockOutReasons.insufficientHours && (
                  <p>
                    You have only worked <span className="font-semibold">{formatHoursWorked(calculateCurrentHoursWorked())}</span> today. 
                    The required minimum is <span className="font-semibold">9 hours</span>.
                  </p>
                )}
                {earlyClockOutReasons.beforeEndTime && currentEmployee?.working_hours_end && (
                  <p>
                    Your scheduled end time is <span className="font-semibold">{formatTimeDisplay(currentEmployee.working_hours_end)}</span>.
                  </p>
                )}
                <p className="pt-2">Are you sure you want to clock out early?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Working</AlertDialogCancel>
            <AlertDialogAction onClick={handleClockOut}>
              Clock Out Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Late Clock-Out Dialog */}
      <AlertDialog open={showLateClockOutDialog} onOpenChange={setShowLateClockOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-orange-500" />
              Clock Out After End Time
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Your scheduled end time was <span className="font-semibold">{formatTimeDisplay(currentEmployee?.working_hours_end || "18:00:00")}</span> and you've worked <span className="font-semibold">{formatHoursWorked(calculateCurrentHoursWorked())}</span>.
                </p>
                <p>Was this overtime or did you forget to clock out?</p>
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    variant={lateClockOutMode === "overtime" ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => setLateClockOutMode("overtime")}
                  >
                    <Timer className="mr-2 h-4 w-4" />
                    It was overtime — use current time
                  </Button>
                  <Button
                    variant={lateClockOutMode === "missed" ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => setLateClockOutMode("missed")}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    I forgot to clock out — enter actual time
                  </Button>
                </div>
                {lateClockOutMode === "missed" && (
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="missed-time">Actual clock-out time</Label>
                    <Input
                      id="missed-time"
                      type="time"
                      value={missedClockOutTime}
                      onChange={(e) => setMissedClockOutTime(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLateClockOutMode(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLateClockOutConfirm}
              disabled={!lateClockOutMode || (lateClockOutMode === "missed" && !missedClockOutTime)}
            >
              Confirm Clock Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Attendance;
