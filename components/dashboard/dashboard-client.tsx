"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  NormalizedOrder,
  DashboardKPIs,
} from "@/types/order";
import { AuthUser } from "@/types/auth";
import { getStoredAuth, setStoredAuth } from "@/lib/auth";
import { exportFullReportCSV } from "@/lib/export-csv";
import {
  calcKPIs,
  calcTimeSeries,
  calcProductMetrics,
  calcRetailerMetrics,
  calcFarmerMetrics,
  calcStateMetrics,
  StateLevelMetric,
} from "@/lib/metrics-calc";
import { LoginView } from "@/components/auth/login-view";
import { DashboardHeader } from "./header";
import { GlobalFilterBar, GlobalFilterState } from "./global-filter-bar";
import { OverviewView } from "./overview-view";
import { OrdersTable } from "./orders-table";
import { ProductsView } from "./products-view";
import { RetailersView } from "./retailers-view";
import { FarmersView } from "./farmers-view";

interface DashboardClientProps {
  initialOrders: NormalizedOrder[];
  initialKPIs: DashboardKPIs;
  initialTimeSeries: any[];
  initialProducts: any;
  initialRetailers: any;
  initialFarmers: any[];
  initialWatchlist?: any[];
  initialStateMetrics: StateLevelMetric[];
  initialTimestamp: string;
}

export function DashboardClient({
  initialOrders,
  initialKPIs,
  initialTimeSeries,
  initialProducts,
  initialRetailers,
  initialFarmers,
  initialStateMetrics,
  initialTimestamp,
}: DashboardClientProps) {
  // Authentication State
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [orders, setOrders] = useState<NormalizedOrder[]>(initialOrders);
  const [timestamp, setTimestamp] = useState<string>(initialTimestamp);

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  // Default to light theme as requested
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [selectedFarmerUuid, setSelectedFarmerUuid] = useState<string | null>(null);

  // Load stored auth on mount
  useEffect(() => {
    const savedUser = getStoredAuth();
    if (savedUser) {
      setAuthUser(savedUser);
    }
    setAuthChecked(true);
  }, []);

  // Global Filter State
  const [filterState, setFilterState] = useState<GlobalFilterState>({
    startDate: "",
    endDate: "",
    state: "ALL",
    district: "ALL",
    crop: "ALL",
    status: "ALL",
  });

  // Extract distinct filter options from all orders
  const { availableStates, allDistrictsMap, availableCrops } = useMemo(() => {
    const statesSet = new Set<string>();
    const cropsSet = new Set<string>();
    const stateToDistricts = new Map<string, Set<string>>();

    for (const o of orders) {
      const st = o.retailerState || o.farmerState;
      if (st) {
        statesSet.add(st);
        if (!stateToDistricts.has(st)) {
          stateToDistricts.set(st, new Set<string>());
        }
        const dist = o.retailerDistrict || o.farmerDistrict;
        if (dist) stateToDistricts.get(st)!.add(dist);
      }

      for (const c of o.farmerCrops) {
        if (c && c.trim()) cropsSet.add(c.trim());
      }
    }

    return {
      availableStates: Array.from(statesSet).sort(),
      allDistrictsMap: stateToDistricts,
      availableCrops: Array.from(cropsSet).sort(),
    };
  }, [orders]);

  // Derived available districts (scoped to selected state if a state is selected)
  const availableDistricts = useMemo(() => {
    if (filterState.state !== "ALL" && allDistrictsMap.has(filterState.state)) {
      return Array.from(allDistrictsMap.get(filterState.state)!).sort();
    }
    const all = new Set<string>();
    allDistrictsMap.forEach((distSet) => {
      distSet.forEach((d) => all.add(d));
    });
    return Array.from(all).sort();
  }, [filterState.state, allDistrictsMap]);

  // Handle filter changes
  const handleFilterChange = useCallback((patch: Partial<GlobalFilterState>) => {
    setFilterState((prev) => ({ ...prev, ...patch }));
  }, []);

  // Handle filter reset
  const handleResetFilters = useCallback(() => {
    setFilterState({
      startDate: "",
      endDate: "",
      state: "ALL",
      district: "ALL",
      crop: "ALL",
      status: "ALL",
    });
  }, []);

  // Filter orders according to active filters
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Date Range filter
      if (filterState.startDate) {
        const orderDate = o.createdAt ? o.createdAt.toISOString().slice(0, 10) : "";
        if (orderDate && orderDate < filterState.startDate) return false;
      }
      if (filterState.endDate) {
        const orderDate = o.createdAt ? o.createdAt.toISOString().slice(0, 10) : "";
        if (orderDate && orderDate > filterState.endDate) return false;
      }

      // State filter
      if (filterState.state !== "ALL") {
        const target = filterState.state.toLowerCase();
        const matchesRetailer = (o.retailerState || "").toLowerCase() === target;
        const matchesFarmer = (o.farmerState || "").toLowerCase() === target;
        if (!matchesRetailer && !matchesFarmer) return false;
      }

      // District filter
      if (filterState.district !== "ALL") {
        const target = filterState.district.toLowerCase();
        const matchesRetailer = (o.retailerDistrict || "").toLowerCase() === target;
        const matchesFarmer = (o.farmerDistrict || "").toLowerCase() === target;
        if (!matchesRetailer && !matchesFarmer) return false;
      }

      // Crop filter
      if (filterState.crop !== "ALL") {
        const target = filterState.crop.toLowerCase();
        const matchesCrop = o.farmerCrops.some((c) => c.toLowerCase() === target);
        if (!matchesCrop) return false;
      }

      // Status filter
      if (filterState.status !== "ALL") {
        if (o.status.toLowerCase() !== filterState.status.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [orders, filterState]);

  // Derived metrics dynamically recalculated based on filtered orders
  const kpis = useMemo(() => calcKPIs(filteredOrders), [filteredOrders]);
  const timeSeries = useMemo(() => calcTimeSeries(filteredOrders), [filteredOrders]);
  const products = useMemo(() => calcProductMetrics(filteredOrders), [filteredOrders]);
  const retailers = useMemo(() => calcRetailerMetrics(filteredOrders), [filteredOrders]);
  const farmers = useMemo(() => calcFarmerMetrics(filteredOrders), [filteredOrders]);
  const stateMetrics = useMemo(() => calcStateMetrics(filteredOrders), [filteredOrders]);

  // Toggle dark/light theme on <html>
  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return next;
    });
  };

  // Live refresh from server
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const ordersRes = await fetch(`/api/orders?limit=2500&t=${Date.now()}`, {
        cache: "no-store",
      });
      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setOrders(oData.orders);
        setTimestamp(new Date().toISOString());
      }
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFarmerSelect = (uuid: string) => {
    setSelectedFarmerUuid(uuid);
    setActiveTab("farmers");
  };

  const handleLogout = () => {
    setStoredAuth(null);
    setAuthUser(null);
  };

  const handleDownloadFullReport = () => {
    exportFullReportCSV(filteredOrders);
  };

  // If auth has loaded and user is not signed in, show the Login Screen
  if (authChecked && !authUser) {
    return <LoginView onLoginSuccess={(u) => setAuthUser(u)} />;
  }

  // Prevent flash while checking auth
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Loading Coromandel CPC Portal...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header & Navigation with Logo, Role, and Full Report Download */}
      <DashboardHeader
        totalRecords={orders.length}
        lastUpdated={timestamp}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== "farmers") setSelectedFarmerUuid(null);
        }}
        authUser={authUser}
        onLogout={handleLogout}
        onDownloadFullReport={handleDownloadFullReport}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Global Multi-Tab Analytics Filters Bar */}
        <GlobalFilterBar
          filterState={filterState}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          availableStates={availableStates}
          availableDistricts={availableDistricts}
          availableCrops={availableCrops}
          totalOrdersCount={orders.length}
          filteredOrdersCount={filteredOrders.length}
          activeTab={activeTab}
        />

        {activeTab === "overview" && (
          <OverviewView
            kpis={kpis}
            timeSeries={timeSeries}
            topProducts={products?.topProducts || []}
            topRetailers={retailers?.leaderboard || []}
            stateMetrics={stateMetrics}
            onNavigateTab={setActiveTab}
            onDateFilterChange={(start, end) =>
              handleFilterChange({
                startDate: start || "",
                endDate: end || "",
              })
            }
          />
        )}

        {activeTab === "orders" && (
          <OrdersTable
            orders={filteredOrders}
            filterOptions={{
              states: availableStates,
              districts: availableDistricts,
              retailers: [],
              crops: availableCrops,
            }}
            onSelectFarmer={handleFarmerSelect}
          />
        )}

        {activeTab === "products" && (
          <ProductsView
            topProducts={products?.topProducts || []}
            packSizeBreakdown={products?.packSizeBreakdown || []}
          />
        )}

        {activeTab === "retailers" && (
          <RetailersView
            leaderboard={retailers?.leaderboard || []}
            stateChartData={retailers?.stateChartData || []}
          />
        )}

        {activeTab === "farmers" && (
          <FarmersView
            farmers={farmers}
            initialSelectedFarmerUuid={selectedFarmerUuid}
          />
        )}
      </main>

      {/* Clean Footer (Dynamic Server Parser line completely removed) */}
      <footer className="border-t border-border/60 bg-card/40 py-4 px-6 text-center text-xs text-muted-foreground mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Coromandel International Limited — Crop Protection Chemicals (CPC) Division.</p>
          <p className="text-muted-foreground/80">Authorized Agri-Retail Distribution Network</p>
        </div>
      </footer>
    </div>
  );
}
