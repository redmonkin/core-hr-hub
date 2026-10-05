import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, Download, FileText, Loader2, Table } from "lucide-react";
import { format, subMonths, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { DatePresets } from "./DatePresets";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { drawPdfHeader, drawPdfFooter, fetchImageAsDataUrl, PDF_TABLE_HEAD_STYLE } from "@/lib/pdfTheme";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface PerformanceAnalyticsProps {
  employeeId: string;
}

export function PerformanceAnalytics({ employeeId }: PerformanceAnalyticsProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(subMonths(new Date(), 6));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const { data: branding } = useCompanyBranding();

  // Fetch KPIs for trend analysis
  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ["goals-analytics", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch performance reviews for rating trends
  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["reviews-analytics", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_reviews")
        .select("*")
        .eq("employee_id", employeeId)
        .order("review_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  if (goalsLoading || reviewsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Filter data by date range
  const filterByDateRange = (date: string | null) => {
    if (!date || !startDate || !endDate) return true;
    const itemDate = new Date(date);
    return isWithinInterval(itemDate, {
      start: startOfDay(startDate),
      end: endOfDay(endDate),
    });
  };

  const filteredGoals = goals?.filter((goal) => filterByDateRange(goal.created_at)) || [];
  const filteredReviews = reviews?.filter((review) => filterByDateRange(review.review_date)) || [];

  // Process KPIs data for status distribution
  const goalStatusData = filteredGoals.reduce((acc, goal) => {
    const status = goal.status || "not_started";
    const existing = acc.find((item) => item.status === status);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ status, count: 1 });
    }
    return acc;
  }, [] as { status: string; count: number }[]);

  const statusLabels: Record<string, string> = {
    not_started: "Not started",
    in_progress: "In progress",
    completed: "Completed",
    on_hold: "On hold",
  };

  const statusColors: Record<string, string> = {
    not_started: "hsl(var(--muted-foreground))",
    in_progress: "hsl(var(--primary))",
    completed: "hsl(142 76% 36%)",
    on_hold: "hsl(38 92% 50%)",
  };

  // Process KPIs for monthly completion trend
  const monthlyGoalsTrend = filteredGoals.reduce((acc, goal) => {
    if (goal.completed_at && filterByDateRange(goal.completed_at)) {
      const month = new Date(goal.completed_at).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
      const existing = acc.find((item) => item.month === month);
      if (existing) {
        existing.completed += 1;
      } else {
        acc.push({ month, completed: 1 });
      }
    }
    return acc;
  }, [] as { month: string; completed: number }[]);

  // Process reviews for rating trend
  const ratingTrend = filteredReviews.map((review) => ({
    period: review.review_period,
    rating: review.overall_rating || 0,
    date: new Date(review.review_date).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
  }));

  // Calculate average progress
  const avgProgress = filteredGoals.length
    ? Math.round(
        filteredGoals.reduce((sum, goal) => sum + (goal.progress || 0), 0) / filteredGoals.length
      )
    : 0;

  // Calculate average rating
  const ratingsWithValue = filteredReviews.filter((r) => r.overall_rating);
  const avgRating = ratingsWithValue.length
    ? (
        ratingsWithValue.reduce((sum, r) => sum + (r.overall_rating || 0), 0) /
        ratingsWithValue.length
      ).toFixed(1)
    : "N/A";

  const hasKPIData = filteredGoals.length > 0;
  const hasReviewData = filteredReviews.length > 0;

  // Export to CSV
  const exportToCSV = () => {
    const dateRange = `${startDate ? format(startDate, "yyyy-MM-dd") : "all"}_to_${endDate ? format(endDate, "yyyy-MM-dd") : "all"}`;
    
    // KPIs CSV
    let csvContent = "Performance Analytics Report\n";
    csvContent += `Date Range: ${startDate ? format(startDate, "PPP") : "All"} to ${endDate ? format(endDate, "PPP") : "All"}\n\n`;
    
    csvContent += "SUMMARY\n";
    csvContent += `Total KPIs,${filteredGoals.length}\n`;
    csvContent += `Average Progress,${avgProgress}%\n`;
    csvContent += `Total Reviews,${filteredReviews.length}\n`;
     csvContent += `Average Rating,${avgRating}\n\n`;
    
     csvContent += "KPIs\n";
    csvContent += "Title,Status,Progress,Priority,Due Date,Created At\n";
    filteredGoals.forEach((goal) => {
      csvContent += `"${goal.title}",${goal.status},${goal.progress || 0}%,${goal.priority || "N/A"},${goal.due_date || "N/A"},${goal.created_at ? format(new Date(goal.created_at), "yyyy-MM-dd") : "N/A"}\n`;
    });
    
    csvContent += "\nPERFORMANCE REVIEWS\n";
    csvContent += "Review Period,Date,Rating,Status\n";
    filteredReviews.forEach((review) => {
      csvContent += `"${review.review_period}",${review.review_date},${review.overall_rating || "N/A"},${review.status}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `performance_analytics_${dateRange}.csv`;
    link.click();
    toast.success("CSV exported successfully");
  };

  // Export to PDF
  const exportToPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const dateRange = `${startDate ? format(startDate, "MMM d, yyyy") : "All"} to ${endDate ? format(endDate, "MMM d, yyyy") : "All"}`;
    const logoDataUrl = await fetchImageAsDataUrl(branding?.logoUrl);

    const currentY = drawPdfHeader(doc, {
      title: "Performance Analytics Report",
      subtitle: `Date Range: ${dateRange}`,
      companyName: branding?.companyName,
      companyAddress: branding?.companyAddress,
      logoDataUrl,
      pageWidth,
      margin,
    });

    // Summary section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, currentY);

    autoTable(doc, {
      startY: currentY + 5,
      head: [["Metric", "Value"]],
      body: [
        ["Total KPIs", filteredGoals.length.toString()],
        ["Average Progress", `${avgProgress}%`],
        ["Total Reviews", filteredReviews.length.toString()],
        ["Average Rating", avgRating.toString()],
      ],
      theme: "striped",
      headStyles: PDF_TABLE_HEAD_STYLE,
    });

    // Goals section
    const goalsStartY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("KPIs", margin, goalsStartY);

    if (filteredGoals.length > 0) {
      autoTable(doc, {
        startY: goalsStartY + 5,
        head: [["Title", "Status", "Progress", "Priority", "Due Date"]],
        body: filteredGoals.map((goal) => [
          goal.title,
          statusLabels[goal.status] || goal.status,
          `${goal.progress || 0}%`,
          goal.priority || "N/A",
          goal.due_date || "N/A",
        ]),
        theme: "striped",
        headStyles: PDF_TABLE_HEAD_STYLE,
      });
    }

    // Reviews section
    const reviewsStartY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Performance Reviews", margin, reviewsStartY);

    if (filteredReviews.length > 0) {
      autoTable(doc, {
        startY: reviewsStartY + 5,
        head: [["Review Period", "Date", "Rating", "Status"]],
        body: filteredReviews.map((review) => [
          review.review_period,
          review.review_date,
          review.overall_rating?.toString() || "N/A",
          review.status,
        ]),
        theme: "striped",
        headStyles: PDF_TABLE_HEAD_STYLE,
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawPdfFooter(doc, { pageWidth, pageHeight, margin, pageNumber: i, totalPages: pageCount });
    }

    doc.save(`performance_analytics_${startDate ? format(startDate, "yyyy-MM-dd") : "all"}_to_${endDate ? format(endDate, "yyyy-MM-dd") : "all"}.pdf`);
    toast.success("PDF exported successfully");
  };

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <span className="text-sm font-medium">Date range</span>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:flex">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      aria-label={startDate ? `Start date, ${format(startDate, "MMM d, yyyy")}` : "Start date"}
                      className={cn(
                        "w-full justify-start px-3 text-left font-normal sm:w-[160px]",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
                      <span className="truncate">{startDate ? format(startDate, "MMM d, yyyy") : "Start"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-sm text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      aria-label={endDate ? `End date, ${format(endDate, "MMM d, yyyy")}` : "End date"}
                      className={cn(
                        "w-full justify-start px-3 text-left font-normal sm:w-[160px]",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
                      <span className="truncate">{endDate ? format(endDate, "MMM d, yyyy") : "End"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="self-start sm:self-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV}>
                  <Table className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <DatePresets
            startDate={startDate}
            endDate={endDate}
            onSelect={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
          />
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="text-2xl font-bold">{filteredGoals.length}</div>
            <p className="text-sm text-muted-foreground">Total KPIs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="text-2xl font-bold">{avgProgress}%</div>
            <p className="text-sm text-muted-foreground">Avg. progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="text-2xl font-bold">{filteredReviews.length}</div>
            <p className="text-sm text-muted-foreground">Reviews</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="text-2xl font-bold">{ratingsWithValue.length ? avgRating : "—"}</div>
            <p className="text-sm text-muted-foreground">
              {ratingsWithValue.length ? "Avg. rating" : "No ratings yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* KPI Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">KPI Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {hasKPIData ? (
              <div
                role="img"
                aria-label={`KPI status: ${goalStatusData
                  .map((d) => `${statusLabels[d.status] || d.status} ${d.count}`)
                  .join(", ")}`}
              >
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={goalStatusData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={goalStatusData.length > 1 ? 3 : 0}
                    stroke={goalStatusData.length > 1 ? undefined : "none"}
                    dataKey="count"
                    nameKey="status"
                    isAnimationActive={false}
                  >
                    {goalStatusData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={statusColors[entry.status] || "hsl(var(--muted))"}
                        aria-label={`${statusLabels[entry.status] || entry.status}: ${entry.count}`}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      value,
                      statusLabels[name as string] || name,
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value: string, entry) => {
                      const count = (entry?.payload as { count?: number } | undefined)?.count;
                      return (
                        <span className="text-sm text-foreground">
                          {statusLabels[value] || value}
                          {count !== undefined ? ` (${count})` : ""}
                        </span>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                No KPI data in selected range
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Rating Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance Rating Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {hasReviewData && ratingTrend.length > 0 ? (
              <div role="img" aria-label="Performance rating trend over time">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={ratingTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    domain={[0, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                No review data in selected range
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPIs Completion Trend */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">KPIs Completed Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyGoalsTrend.length > 0 ? (
              <div role="img" aria-label="KPIs completed per month">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyGoalsTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    allowDecimals={false}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="completed"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                No completed KPIs in selected range
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
