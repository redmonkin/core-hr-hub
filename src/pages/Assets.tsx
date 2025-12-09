import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AssetCard, Asset } from "@/components/assets/AssetCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Package, Laptop, Monitor, Smartphone } from "lucide-react";

const mockAssets: Asset[] = [
  {
    id: "1",
    name: "MacBook Pro 16\"",
    type: "laptop",
    serialNumber: "C02XL0HPJGH7",
    purchaseDate: "Jan 15, 2024",
    cost: 2499,
    status: "assigned",
    assignedTo: {
      name: "Sarah Miller",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    },
  },
  {
    id: "2",
    name: "Dell UltraSharp 27\"",
    type: "monitor",
    serialNumber: "CN-0G2410-2827",
    purchaseDate: "Feb 20, 2024",
    cost: 699,
    status: "assigned",
    assignedTo: {
      name: "Mike Johnson",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    },
  },
  {
    id: "3",
    name: "iPhone 15 Pro",
    type: "phone",
    serialNumber: "FFMXT4RRJPH8",
    purchaseDate: "Mar 10, 2024",
    cost: 1199,
    status: "available",
  },
  {
    id: "4",
    name: "MacBook Air M2",
    type: "laptop",
    serialNumber: "C02ZRKPJML7H",
    purchaseDate: "Apr 5, 2024",
    cost: 1299,
    status: "available",
  },
  {
    id: "5",
    name: "LG 32\" 4K Monitor",
    type: "monitor",
    serialNumber: "LG32UK50T-W",
    purchaseDate: "May 12, 2024",
    cost: 449,
    status: "maintenance",
  },
  {
    id: "6",
    name: "Sony WH-1000XM5",
    type: "accessory",
    serialNumber: "SN-WH1000XM5-001",
    purchaseDate: "Jun 1, 2024",
    cost: 349,
    status: "assigned",
    assignedTo: {
      name: "Emily Chen",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    },
  },
];

const assetStats = [
  { label: "Total Assets", value: 186, icon: <Package className="h-5 w-5" /> },
  { label: "Laptops", value: 72, icon: <Laptop className="h-5 w-5" /> },
  { label: "Monitors", value: 68, icon: <Monitor className="h-5 w-5" /> },
  { label: "Mobile Devices", value: 46, icon: <Smartphone className="h-5 w-5" /> },
];

const Assets = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredAssets = mockAssets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.serialNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || asset.type === typeFilter;
    const matchesStatus = statusFilter === "all" || asset.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Asset Management</h2>
            <p className="text-muted-foreground">Track and manage company assets</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {assetStats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-xl bg-primary/10 p-3 text-primary">{stat.icon}</div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="laptop">Laptops</SelectItem>
              <SelectItem value="monitor">Monitors</SelectItem>
              <SelectItem value="phone">Phones</SelectItem>
              <SelectItem value="accessory">Accessories</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Asset Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Assets;
