// Navigation helper shared by the dashboard pieces (cards, search results, add-box
// sheet) so they all open a box the same way.
import { router } from 'expo-router';
import { routes } from '@/lib/routes';

/** Navigate to a box's detail screen. */
export function openBox(id: string): void {
  router.push(routes.box(id));
}
