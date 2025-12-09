import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const leaves = [
  { name: "Sarah Miller", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face", type: "Annual", days: "9-11 Dec" },
  { name: "John Smith", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face", type: "Sick", days: "9 Dec" },
  { name: "Emily Chen", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face", type: "Annual", days: "10-13 Dec" },
];

export function LeaveCalendar() {
  const [currentDate] = useState(new Date());
  
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Who's Out</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{monthName}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {leaves.map((leave, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={leave.avatar} />
              <AvatarFallback>{leave.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{leave.name}</p>
              <p className="text-xs text-muted-foreground">{leave.days}</p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {leave.type}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
