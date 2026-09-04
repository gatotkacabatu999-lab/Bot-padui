export interface DeliveryPoint {
  code: string;
  name: string;
  delivery: string; // e.g. "MON,WED,FRI"
  latitude: number;
  longitude: number;
  descriptions?: Array<{ key: string; value: string }>;
  markerColor?: string;
  qrCodeImageUrl?: string;
  avatarImageUrl?: string;
}

export interface Route {
  id: string;
  name: string;
  code: string;
  shift: 'AM' | 'PM';
  color?: string;
  labels?: string[];
  deliveryPoints: DeliveryPoint[];
  updatedAt?: string;
}

export interface RoutesApiResponse {
  success: boolean;
  data?: Route[];
  error?: string;
}
