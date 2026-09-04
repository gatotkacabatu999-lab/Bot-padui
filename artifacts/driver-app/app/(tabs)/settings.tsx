import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { clearAllVisited } from '@/lib/storage';

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[s.sectionHeader, { color: colors.mutedForeground }]}>
      {title.toUpperCase()}
    </Text>
  );
}

interface RowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

function Row({ icon, label, value, onPress, destructive, disabled }: RowProps) {
  const colors = useColors();
  const tint = destructive ? colors.destructive : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || disabled}
      style={({ pressed }) => [
        s.row,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[s.iconBox, { backgroundColor: destructive ? colors.destructive + '18' : colors.muted }]}>
        <Feather name={icon} size={16} color={tint} />
      </View>
      <Text style={[s.rowLabel, { color: tint }]}>{label}</Text>
      {value ? (
        <Text style={[s.rowValue, { color: colors.mutedForeground }]} numberOfLines={1}>
          {value}
        </Text>
      ) : onPress ? (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      ) : null}
    </Pressable>
  );
}

function Divider() {
  const colors = useColors();
  return <View style={[s.divider, { backgroundColor: colors.border }]} />;
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [clearing, setClearing] = useState(false);
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? 'localhost';
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleClearVisited = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Padam Rekod Kunjungan',
      'Semua tanda "Dilawati" akan dipadam. Ini tidak boleh dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Padam',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await clearAllVisited();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Selesai', 'Semua rekod kunjungan telah dipadam.');
            } catch {
              Alert.alert('Ralat', 'Gagal memadam rekod.');
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Tetapan</Text>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader title="Pelayan" />
        <View style={[s.group, { borderColor: colors.border }]}>
          <Row icon="server" label="Domain" value={domain} />
          <Divider />
          <Row icon="link" label="API Endpoint" value="/api/routes" />
        </View>

        <SectionHeader title="Data" />
        <View style={[s.group, { borderColor: colors.border }]}>
          <Row
            icon="trash-2"
            label={clearing ? 'Memadamkan...' : 'Padam Rekod Kunjungan'}
            onPress={clearing ? undefined : handleClearVisited}
            destructive
            disabled={clearing}
          />
        </View>

        <SectionHeader title="Maklumat" />
        <View style={[s.group, { borderColor: colors.border }]}>
          <Row icon="package" label="Versi Aplikasi" value="1.0.0" />
          <Divider />
          <Row icon="truck" label="Produk" value="DBRUTALS Driver" />
          <Divider />
          <Row icon="shield" label="Organisasi" value="FamilyMart Malaysia" />
        </View>

        <Text style={[s.footer, { color: colors.mutedForeground }]}>
          DBRUTALS Driver · Penghantaran FamilyMart
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  content: { padding: 20, gap: 6 },
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  group: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  rowValue: { fontSize: 13, fontFamily: 'Inter_400Regular', maxWidth: 160 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 24,
  },
});
