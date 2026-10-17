import type { ElevatorState } from '@domain/elevator';

export const FLOORS = [
  { number: 5, name: 'Panorama' },
  { number: 4, name: 'Studio' },
  { number: 3, name: 'Offices' },
  { number: 2, name: 'Coworking' },
  { number: 1, name: 'Lobby' },
] as const;
export const STATE_LABELS: Record<ElevatorState, string> = {
  idle: 'Idle',
  'moving-up': 'Going up',
  'moving-down': 'Going down',
  opening: 'Opening',
  open: 'Boarding',
  closing: 'Closing',
};
export function floorName(floor: number): string {
  return FLOORS.find((item) => item.number === floor)?.name ?? '';
}
export function formatTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(
      2,
      '0',
    )}:${(seconds % 60).toString().padStart(2, '0')}.${Math.floor((milliseconds % 1000) / 100)}`;
}
