export const COLORS = [
  { name: 'Charcoal', hex: '#131513' },
  { name: 'Surface', hex: '#1C1F1A' },
  { name: 'Smaragd', hex: '#A3CE64' },
  { name: 'Zlato', hex: '#E4C078' },
  { name: 'Slonovina', hex: '#F2F0E8' },
]

export function colorLabelForOrientation(orientation: 'w' | 'b'): string {
  return orientation === 'w' ? 'Bílý dole' : 'Černý dole'
}
