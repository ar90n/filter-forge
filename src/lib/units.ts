/**
 * Unit conversion utilities
 *
 * Format SI base unit values into human-readable strings with appropriate prefixes.
 * Automatically selects the best prefix based on magnitude.
 */

import type { FrequencyUnit } from '@/types/filter.ts'

/**
 * Round a number to the given significant figures and format it.
 * Removes trailing zeros; omits the decimal point for integers.
 */
function formatValue(value: number, precision: number = 3): string {
  if (value === 0) return '0'
  return parseFloat(value.toPrecision(precision)).toString()
}

/**
 * Format a capacitance value (F -> pF/nF/uF/mF)
 * @param valueInFarads - Capacitance in Farads
 * @returns Formatted string (e.g. "100 pF", "4.7 nF", "10 uF")
 */
export function formatCapacitance(valueInFarads: number): string {
  if (valueInFarads === 0) return '0 F'
  const abs = Math.abs(valueInFarads)
  if (abs >= 1e-3) return `${formatValue(valueInFarads * 1e3)} mF`
  if (abs >= 1e-6) return `${formatValue(valueInFarads * 1e6)} uF`
  if (abs >= 1e-9) return `${formatValue(valueInFarads * 1e9)} nF`
  return `${formatValue(valueInFarads * 1e12)} pF`
}

/**
 * Format an inductance value (H -> uH/mH/H)
 * @param valueInHenrys - Inductance in Henrys
 * @returns Formatted string (e.g. "100 uH", "4.7 mH", "1 H")
 */
export function formatInductance(valueInHenrys: number): string {
  if (valueInHenrys === 0) return '0 H'
  const abs = Math.abs(valueInHenrys)
  if (abs >= 1) return `${formatValue(valueInHenrys)} H`
  if (abs >= 1e-3) return `${formatValue(valueInHenrys * 1e3)} mH`
  return `${formatValue(valueInHenrys * 1e6)} uH`
}

/**
 * Format a resistance value (Ohm -> Ohm/kOhm/MOhm)
 * @param valueInOhms - Resistance in Ohms
 * @returns Formatted string (e.g. "100 Ohm", "4.7 kOhm", "1 MOhm")
 */
export function formatResistance(valueInOhms: number): string {
  if (valueInOhms === 0) return '0 Ω'
  const abs = Math.abs(valueInOhms)
  if (abs >= 1e6) return `${formatValue(valueInOhms / 1e6)} MΩ`
  if (abs >= 1e3) return `${formatValue(valueInOhms / 1e3)} kΩ`
  return `${formatValue(valueInOhms)} Ω`
}

/**
 * Format a frequency value (Hz -> Hz/kHz/MHz)
 * @param valueInHz - Frequency in Hz
 * @returns Formatted string (e.g. "100 Hz", "4.7 kHz", "1 MHz")
 */
export function formatFrequency(valueInHz: number): string {
  if (valueInHz === 0) return '0 Hz'
  const abs = Math.abs(valueInHz)
  if (abs >= 1e6) return `${formatValue(valueInHz / 1e6)} MHz`
  if (abs >= 1e3) return `${formatValue(valueInHz / 1e3)} kHz`
  return `${formatValue(valueInHz)} Hz`
}

/**
 * Convert a frequency value to Hz
 * @param value - Frequency value
 * @param unit - Frequency unit
 * @returns Value in Hz
 */
export function convertToHz(value: number, unit: FrequencyUnit): number {
  switch (unit) {
    case 'Hz':
      return value
    case 'kHz':
      return value * 1e3
    case 'MHz':
      return value * 1e6
  }
}
