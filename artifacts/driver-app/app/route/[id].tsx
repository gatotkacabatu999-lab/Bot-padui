import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { fetchRoutes, haversineKm, openNavigation } from '@/lib/api';
import { getVisited, toggleVisited } from '@/lib/storage';
import type { DeliveryPoint } from '@/lib/types';

// ── Stop item ─────────────────────────────────────────────────────────────────

interface StopItemProps {
  point: DeliveryPoint;
  index: number;
  distKm: number | null; // distance to NEXT stop, null for last
  visited: boolean;
  onToggleVisited: () => void;
  onNavigate: () => void;
}

function StopItem({ point, index, distKm, visited, onToggleVisited, onNavigate }: StopItemProps) {
  const colors = useColors();
  return (
    <View
      style={[
        s.stopCard,
        {
          backgroundColor: visited ? colors.success + '0E' : colors.card,
          borderColor: visited ? colors.success + '44' : colors.border,
        },
      ]}
    >
      {/* Step number + connector */}
      <View style={s.stepCol}>
        <View
          style={[
            s.stepBubble,
            { backgroundColor: visited ? colors.success : colors.primary },
          ]}
        >
          {visited ? (
            <Feather name="check" size={12} color="#fff" />
          ) : (
            <Text style={s.stepNumber}>{index + 1}</Text>
          )}
        </View>
        {distKm !== null && (
          <View style={[s.connector, { backgroundColor: colors.border }]} />
        )}
      </View>

      {/* Stop info */}
      <View style={s.stopBody}>
        <View style={s.stopHeader}>
          <Text style={[s.stopName, { color: colors.foreground }]} numberOfLines={2}>
            {point.name}
          </Text>
          <View style={[s.stopCodePill, { backgroundColor: colors.muted }]}>
            <Text style={[s.stopCode, { color: colors.mutedForeground }]}>{point.code}</Text>
          </View>
        </View>

        {point.delivery ? (
          <Text style={[s.deliveryDays, { color: colors.mutedForeground }]}>
            {point.delivery}
          </Text>
        ) : null}

        {/* Distance to next */}
        {distKm !== null && (
          <View style={s.distRow}>
            <Feather name="arrow-down" size={10} color={colors.mutedForeground} />
            <Text style={[s.distText, { color: colors.mutedForeground }]}>
              {distKm < 1
                ? `${Math.round(distKm * 1000)} m ke stop seterusnya`
                : `${distKm.toFixed(1)} km ke stop seterusnya`}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={s.stopActions}>
          <Pressable
            onPress={onToggleVisited}
            style={({ pressed }) => [
              s.actionBtn,
              {
                backgroundColor: visited ? colors.success + '22' : colors.muted,
                borderColor: visited ? colors.success + '44' : colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name={visited ? 'check-circle' : 'circle'} size={14} color={visited ? colors.success : colors.mutedForeground} />
            <Text style={[s.actionText, { color: visited ? colors.success : colors.mutedForeground }]}>
              {visited ? 'Dilawati' : 'Tandakan'}
            </Text>
          </Pressable>

          {point.latitude !== 0 && point.longitude !== 0 && (
            <Pressable
              onPress={onNavigate}
              style={({ pressed }) => [
                s.actionBtn,
                s.navBtn,
                { backgroundColor: colors.primary + '18', borderColor: colors.primary + '33', opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="navigation" size={14} color={colors.primary} />
              <Text style={[s.actionText, { color: colors.primary }]}>Navigasi</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function RouteDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visited, setVisited] = useState<Set<string>>(new Set());

  const { data: routes, isLoading, error } = useQuery({
    queryKey: ['routes'],
    queryFn: fetchRoutes,
    staleTime: 30_000,
  });

  const route = routes?.find((r) => r.id === id);
  const points: DeliveryPoint[] = route?.deliveryPoints ?? [];

  // Load visited stops from AsyncStorage
  useEffect(() => {
    if (!id) return;
    getVisited(id).then(setVisited);
  }, [id]);

  const handleToggleVisited = useCallback(
    async (stopCode: string) => {
      if (!id) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const next = await toggleVisited(id, stopCode);
      setVisited(new Set(next));
    },
    [id],
  );

  const handleNavigate = useCallback((point: DeliveryPoint) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openNavigation(point.latitude, point.longitude, point.name);
  }, []);

  // Compute total haversine km
  const totalKm = React.useMemo(() => {
    if (points.length < 2) return 0;
    let sum = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (a.latitude && b.latitude) {
        sum += haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
      }
    }
    return sum;
  }, [points]);

  const visitedCount = visited.size;
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  if (isLoading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error || !route) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.destructive} />
        <Text style={[s.errorMsg, { color: colors.mutedForeground }]}>
          {error ? (error as Error).message : 'Laluan tidak dijumpai'}
        </Text>
        <Pressable onPress={() => router.back()} style={[s.backBtn, { backgroundColor: colors.muted }]}>
          <Text style={[s.backBtnText, { color: colors.foreground }]}>Kembali</Text>
        </Pressable>
      </View>
    );
  }

  const isAM = route.shift === 'AM';

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Custom header */}
      <View
        style={[
          s.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backPress}>
          <Feather name="chevron-left" size={24} color={colors.primary} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {route.name}
          </Text>
          <View style={[s.codeBadge, { backgroundColor: colors.muted }]}>
            <Text style={[s.codeBadgeText, { color: colors.mutedForeground }]}>{route.code}</Text>
          </View>
        </View>
        <View
          style={[
            s.shiftBadge,
            { backgroundColor: isAM ? colors.success + '22' : colors.warning + '22' },
          ]}
        >
          <Text style={[s.shiftText, { color: isAM ? colors.success : colors.warning }]}>
            {route.shift}
          </Text>
        </View>
      </View>

      {/* Summary strip */}
      <View style={[s.summaryStrip, { backgroundColor: colors.muted, borderBottomColor: colors.border }]}>
        <View style={s.summaryItem}>
          <Feather name="map-pin" size={14} color={colors.primary} />
          <Text style={[s.summaryValue, { color: colors.foreground }]}>{points.length}</Text>
          <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Stop</Text>
        </View>
        <View style={[s.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={s.summaryItem}>
          <Feather name="check-circle" size={14} color={colors.success} />
          <Text style={[s.summaryValue, { color: colors.foreground }]}>{visitedCount}</Text>
          <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Dilawati</Text>
        </View>
        <View style={[s.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={s.summaryItem}>
          <Feather name="navigation" size={14} color={colors.primary} />
          <Text style={[s.summaryValue, { color: colors.foreground }]}>
            {totalKm < 1 ? `${Math.round(totalKm * 1000)}m` : `${totalKm.toFixed(1)}km`}
          </Text>
          <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Jarak</Text>
        </View>
      </View>

      {/* Stop list */}
      <FlatList
        data={points}
        keyExtractor={(p, i) => `${p.code}-${i}`}
        contentContainerStyle={[s.list, { paddingBottom: bottomPad + 24 }]}
        scrollEnabled={points.length > 0}
        renderItem={({ item, index }) => {
          const next = points[index + 1];
          const distKm =
            next && item.latitude && next.latitude
              ? haversineKm(item.latitude, item.longitude, next.latitude, next.longitude)
              : null;
          return (
            <StopItem
              point={item}
              index={index}
              distKm={distKm}
              visited={visited.has(item.code)}
              onToggleVisited={() => handleToggleVisited(item.code)}
              onNavigate={() => handleNavigate(item)}
            />
          );
        }}
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Feather name="inbox" size={36} color={colors.mutedForeground} />
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Tiada stop dalam laluan ini</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  errorMsg: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  backBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  backBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPress: { padding: 4 },
  headerCenter: { flex: 1, gap: 4 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  codeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  codeBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  shiftBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  shiftText: { fontSize: 13, fontFamily: 'Inter_700Bold' },

  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  summaryLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  summaryDivider: { width: 1, height: 20 },

  list: { padding: 16, gap: 0 },

  stopCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  stepCol: { alignItems: 'center', paddingVertical: 16, paddingLeft: 14, paddingRight: 4, width: 42 },
  stepBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#fff' },
  connector: { flex: 1, width: 2, marginTop: 4, borderRadius: 1 },

  stopBody: { flex: 1, padding: 14, paddingLeft: 8, gap: 6 },
  stopHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stopName: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  stopCodePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, marginTop: 2 },
  stopCode: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  deliveryDays: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  stopActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  navBtn: {},
  actionText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
