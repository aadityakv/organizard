// Navigation helper shared by the dashboard pieces.
import { router } from 'expo-router';

/** Navigate to a box's detail screen. */
export function openBox(id: string): void {
  router.push(`/box/${id}`);
}
