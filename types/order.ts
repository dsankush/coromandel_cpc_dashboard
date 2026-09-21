export type ApprovalStatusCode = 0 | 1 | 2;

export enum ApprovalStatus {
  Pending = "Pending",
  Approved = "Approved",
  Rejected = "Rejected",
}

export interface RawOrderCSVRow {
  retailer_no: string;
  retailer_name: string;
  retailer_location: string;
  retailer_short_code: string;
  retailer_locale_code: string;
  retailer_district: string;
  retailer_state: string;
  retailer_address: string;
  retailer_pin_code: string;
  farmer_no: string;
  farmer_name: string;
  farmer_uuid: string;
  farmer_state: string;
  farmer_district: string;
  farmer_crop: string;
  farmer_land: string;
  address: string;
  purchase_id: string;
  product1_name: string;
  is_approve_by_retailer: string;
  retailer_approve_date: string;
  no_product_purchase: string;
  wa_status: string;
  coupon_code: string;
  created_at: string;
}

export interface ParsedLineItem {
  productName: string;
  skuSize: string;
  packSize: string; // backwards-compatible alias
  quantity: number;
  rawString: string;
}

export interface NormalizedOrder {
  id: string;
  purchaseId: string;
  retailerNo: string;
  retailerName: string;
  retailerLocation: string;
  retailerShortCode: string;
  retailerLocaleCode: string;
  retailerDistrict: string;
  retailerState: string;
  retailerAddress: string;
  retailerPinCode: string;
  farmerNo: string;
  farmerName: string;
  farmerUuid: string;
  farmerState: string;
  farmerDistrict: string;
  farmerCrops: string[];
  farmerLandAcres: number | null;
  farmerLandRaw: string;
  deliveryAddress: string;
  statusCode: ApprovalStatusCode;
  status: ApprovalStatus;
  retailerApproveDate: Date | null;
  retailerApproveDateStr: string | null;
  noProductPurchase: number;
  waStatus: string;
  couponCodes: string[];
  createdAt: Date;
  createdAtStr: string;
  approvalLatencyHours: number | null;
  locationMismatch: boolean;
  lineItems: ParsedLineItem[];
  rawProductName: string;
}

export interface AnomalyProfile {
  farmerUuid: string;
  farmerName: string;
  farmerNo: string;
  farmerState: string;
  farmerDistrict: string;
  totalOrders: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  uniqueRetailersCount: number;
  uniqueStatesCount: number;
  crops: string[];
  farmerLandRaw: string;
  riskScore: number; // 0 to 100
  flagReasons: string[];
  anomalies: {
    multiRetailerVelocity: boolean;
    zeroApprovalPattern: boolean;
    dummyAccountFingerprint: boolean;
    highLocationMismatch: boolean;
  };
  sampleOrders: NormalizedOrder[];
}

export interface DashboardKPIs {
  totalOrders: number;
  approvedOrders: number;
  pendingOrders: number;
  rejectedOrders: number;
  approvedPercentage: number;
  pendingPercentage: number;
  rejectedPercentage: number;
  totalUnitsSold: number;
  uniqueFarmers: number;
  uniqueRetailers: number;
  activeStatesCount?: number;
  activeDistrictsCount?: number;
  avgApprovalLatencyHours?: number;
  locationMismatchCount?: number;
  locationMismatchPercentage?: number;
  totalFlaggedFarmers?: number;
}
