import type { Route, RoutesApiResponse } from './types';

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : '';
}

export async function fetchRoutes(): Promise<Route[]> {
  const res = await fetch(`${getBaseUrl()}/api/routes`, {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 401) {
    throw new Error('AUTH_REQUIRED');
  }
  if (!res.ok) {
    const body: Partial<RoutesApiResponse> = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Server error ${res.status}`);
  }
  const body: RoutesApiResponse = await res.json();
  if (!body.success || !Array.isArray(body.data)) {
    throw new Error(body.error ?? 'Unexpected response');
  }
  return body.data;
}

/** Haversine great-circle distance in km */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Open native maps app for turn-by-turn navigation */
import { Linking, Platform } from 'react-native';

export function openNavigation(lat: number, lng: number, label: string): void {
  let url: string;
  const enc = encodeURIComponent(label);
  if (Platform.OS === 'ios') {
    url = `maps:0,0?q=${enc}@${lat},${lng}`;
  } else if (Platform.OS === 'android') {
    url = `geo:${lat},${lng}?q=${lat},${lng}(${enc})`;
  } else {
    url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  Linking.openURL(url).catch(() => {
    // Fallback to Google Maps web
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  });
}
