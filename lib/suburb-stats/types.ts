export interface SuburbPrices {
  medianHouse?: string;
  medianUnit?: string;
  annualGrowthHouse?: string;
  annualGrowthUnit?: string;
  daysOnMarket?: string;
  auctionClearanceRate?: string;
}

export interface NearbyPlace {
  name: string;
  vicinity?: string;
  rating?: number;
  distanceMeters?: number;
  types?: string[];
}

export interface SuburbSchool extends NearbyPlace {
  level?: "primary" | "secondary" | "combined" | "unknown";
}

export interface SuburbTransport {
  nearestStation?: NearbyPlace;
  trainStations?: NearbyPlace[];
  busStops?: number;
}

export interface SuburbDemographics {
  medianAge?: string;
  ownerRatio?: string;
  renterRatio?: string;
  medianIncome?: string;
  topOccupations?: string[];
}

export interface SuburbCrime {
  level?: "Low" | "Medium" | "High";
  summary?: string;
  categories?: Array<{ name: string; rate: string }>;
}

export interface SuburbLifestyle {
  cafes: number;
  parks: number;
  supermarkets: number;
  restaurants: number;
}

export interface SuburbStats {
  suburb: string;
  state: string;
  postcode: string;
  prices?: SuburbPrices;
  schools?: SuburbSchool[];
  crime?: SuburbCrime;
  transport?: SuburbTransport;
  demographics?: SuburbDemographics;
  lifestyle?: SuburbLifestyle;
  propertyLocation?: { lat: number; lng: number };
  fetchedAt: string;
  sources: string[];
}
