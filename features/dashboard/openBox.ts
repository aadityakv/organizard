import { router } from 'expo-router';

export function openBox(id: string): void {
  router.push(`/box/${id}`);
}
