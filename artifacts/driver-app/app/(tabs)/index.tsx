import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { fetchRoutes } from '@/lib/api';
import type { Route } from '@/lib/types';

type ShiftFilter = 'ALL' | 'AM' | 'PM';

function ShiftBadge({ shift, small }: { shift: 'AM' | 'PM'; small?: boolean }) {
  const colors = useColors();
  const isAM = shift === 'AM';
  return (
    <View
      style={[
        styles.shiftBadge,
        small && styles.shiftBadgeSmall,
        { backgroundColor: isAM ? colors.success + '22' : colors.warning + '22' },
      ]}
    >
      <Text
        style={[
          styles.shiftBadgeText,
          small && styles.shiftBadgeTextSmall,
          { color: isAM ? colors.success : colors.warning },
        ]}
      >
        {shift}
      </Text>
    </View>
  );
}

function RouteCard({ route, onPress }: { route: Route; onPress: () => void }) {
  const colors = useColors();
  const stopCount = route.deliveryPoints?.length ?? 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.cardLeft}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.routeName, { color: colors.foreground }]} numberOfLines={1}>
            {route.name}
          </Text>
          <ShiftBadge shift={route.shift} small />
        </View>
        <View style={styles.cardBottomRow}>
          <View style={[styles.codePill, { backgroundColor: colors.muted }]}>
            <Text style={[styles.codeText, { color: colors.mutedForeground }]}>{route.code}</Text>
          </View>
          <View style={styles.stopCountRow}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text style={[styles.stopCount, { color: colors.mutedForeground }]}>
              {stopCount} {stopCount === 1 ? 'stop' : 'stops'}
            </Text>
          </View>
        </View>
      </View>
      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

function EmptyState({ message, icon }: { message: string; icon: keyof typeof Feather.glyphMap }) {
  const colors = useColors();
  return (
    <View style={styles.emptyContainer}>
      <Feather name={icon} size={40} color={colors.mutedForeground} />
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{message}</Text>
    </View>
  );
}

export default function RoutesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('ALL');
  const [search, setSearch] = useState('');

  const { data: routes, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['routes'],
    queryFn: fetchRoutes,
    retry: 1,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!routes) return [];
    return routes.filter((r) => {
      const matchShift = shiftFilter === 'ALL' || r.shift === shiftFilter;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.deliveryPoints?.some(
          (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
        );
      return matchShift && matchSearch;
    });
  }, [routes, shiftFilter, search]);

  const handleShiftPress = useCallback((f: ShiftFilter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShiftFilter(f);
  }, []);

  const handleRoutePress = useCallback(
    (route: Route) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({ pathname: '/route/[id]', params: { id: route.id } });
    },
    [],
  );

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Laluan</Text>
        <Pressable onPress={() => refetch()} hitSlop={12}>
          <Feather name="refresh-cw" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cari laluan atau stop..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchText, { color: colors.foreground }]}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Shift filter */}
      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {(['ALL', 'AM', 'PM'] as ShiftFilter[]).map((f) => {
          const active = shiftFilter === f;
          return (
            <Pressable
              key={f}
              onPress={() => handleShiftPress(f)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: active ? colors.primary : colors.muted,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.filterPillText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                {f === 'ALL' ? 'Semua' : f}
              </Text>
            </Pressable>
          );
        })}
        {routes && (
          <Text style={[styles.countLabel, { color: colors.mutedForeground }]}>
            {filtered.length} laluan
          </Text>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Memuatkan laluan...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Tidak dapat memuatkan</Text>
          <Text style={[styles.errorMsg, { color: colors.mutedForeground }]}>
            {(error as Error).message === 'AUTH_REQUIRED'
              ? 'Akses tidak dibenarkan. Sila hubungi admin.'
              : (error as Error).message.includes('DATABASE_URL')
              ? 'Pangkalan data belum disambungkan.'
              : (error as Error).message}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Cuba Semula</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 16 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          scrollEnabled={filtered.length > 0}
          renderItem={({ item }) => (
            <RouteCard route={item} onPress={() => handleRoutePress(item)} />
          )}
          ListEmptyComponent={
            search || shiftFilter !== 'ALL' ? (
              <EmptyState message="Tiada laluan sepadan" icon="inbox" />
            ) : (
              <EmptyState message="Tiada laluan lagi" icon="map" />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  countLabel: {
    marginLeft: 'auto',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardLeft: { flex: 1, gap: 8 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeName: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  shiftBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  shiftBadgeSmall: { paddingHorizontal: 6, paddingVertical: 2 },
  shiftBadgeText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  shiftBadgeTextSmall: { fontSize: 11 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  stopCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stopCount: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 8 },
  errorTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', marginTop: 8 },
  errorMsg: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
