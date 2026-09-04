import AsyncStorage from '@react-native-async-storage/async-storage';

const visitedKey = (routeId: string) => `visited:${routeId}`;

export async function getVisited(routeId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(visitedKey(routeId));
    if (!raw) return new Set<string>();
    return new Set<string>(JSON.parse(raw) as string[]);
  } catch {
    return new Set<string>();
  }
}

export async function toggleVisited(
  routeId: string,
  stopCode: string,
): Promise<Set<string>> {
  const visited = await getVisited(routeId);
  if (visited.has(stopCode)) {
    visited.delete(stopCode);
  } else {
    visited.add(stopCode);
  }
  await AsyncStorage.setItem(visitedKey(routeId), JSON.stringify([...visited]));
  return visited;
}

export async function clearAllVisited(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const visitedKeys = keys.filter((k) => k.startsWith('visited:'));
  if (visitedKeys.length > 0) {
    await AsyncStorage.multiRemove(visitedKeys);
  }
}

export async function countVisited(routeId: string): Promise<number> {
  const visited = await getVisited(routeId);
  return visited.size;
}
