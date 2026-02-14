import { describe, it, expect } from 'vitest'
import {
  formatCapacitance,
  formatInductance,
  formatResistance,
  formatFrequency,
  convertToHz,
} from './units.ts'

describe('formatCapacitance', () => {
  it('should format zero value', () => {
    expect(formatCapacitance(0)).toBe('0 F')
  })

  it('should format picofarad range', () => {
    expect(formatCapacitance(100e-12)).toBe('100 pF')
    expect(formatCapacitance(4.7e-12)).toBe('4.7 pF')
    expect(formatCapacitance(1e-12)).toBe('1 pF')
    expect(formatCapacitance(0.5e-12)).toBe('0.5 pF')
  })

  it('should format nanofarad range', () => {
    expect(formatCapacitance(1e-9)).toBe('1 nF')
    expect(formatCapacitance(47e-9)).toBe('47 nF')
    expect(formatCapacitance(100e-9)).toBe('100 nF')
    expect(formatCapacitance(4.7e-9)).toBe('4.7 nF')
  })

  it('should format microfarad range', () => {
    expect(formatCapacitance(1e-6)).toBe('1 uF')
    expect(formatCapacitance(10e-6)).toBe('10 uF')
    expect(formatCapacitance(100e-6)).toBe('100 uF')
    expect(formatCapacitance(4.7e-6)).toBe('4.7 uF')
  })

  it('should format millifarad range', () => {
    expect(formatCapacitance(1e-3)).toBe('1 mF')
    expect(formatCapacitance(10e-3)).toBe('10 mF')
  })

  it('should handle boundary values', () => {
    // 999 pF → pF range
    expect(formatCapacitance(999e-12)).toBe('999 pF')
    // 1000 pF = 1 nF → nF range
    expect(formatCapacitance(1000e-12)).toBe('1 nF')
  })
})

describe('formatInductance', () => {
  it('should format zero value', () => {
    expect(formatInductance(0)).toBe('0 H')
  })

  it('should format microhenry range', () => {
    expect(formatInductance(1e-6)).toBe('1 uH')
    expect(formatInductance(100e-6)).toBe('100 uH')
    expect(formatInductance(4.7e-6)).toBe('4.7 uH')
    expect(formatInductance(0.1e-6)).toBe('0.1 uH')
  })

  it('should format millihenry range', () => {
    expect(formatInductance(1e-3)).toBe('1 mH')
    expect(formatInductance(10e-3)).toBe('10 mH')
    expect(formatInductance(4.7e-3)).toBe('4.7 mH')
  })

  it('should format henry range', () => {
    expect(formatInductance(1)).toBe('1 H')
    expect(formatInductance(2.5)).toBe('2.5 H')
  })

  it('should handle boundary values', () => {
    // 999 uH → uH range
    expect(formatInductance(999e-6)).toBe('999 uH')
    // 1000 uH = 1 mH → mH range
    expect(formatInductance(1000e-6)).toBe('1 mH')
  })
})

describe('formatResistance', () => {
  it('should format zero value', () => {
    expect(formatResistance(0)).toBe('0 Ω')
  })

  it('should format ohm range', () => {
    expect(formatResistance(1)).toBe('1 Ω')
    expect(formatResistance(50)).toBe('50 Ω')
    expect(formatResistance(100)).toBe('100 Ω')
    expect(formatResistance(4.7)).toBe('4.7 Ω')
  })

  it('should format kilohm range', () => {
    expect(formatResistance(1e3)).toBe('1 kΩ')
    expect(formatResistance(10e3)).toBe('10 kΩ')
    expect(formatResistance(4.7e3)).toBe('4.7 kΩ')
  })

  it('should format megaohm range', () => {
    expect(formatResistance(1e6)).toBe('1 MΩ')
    expect(formatResistance(10e6)).toBe('10 MΩ')
    expect(formatResistance(4.7e6)).toBe('4.7 MΩ')
  })

  it('should handle boundary values', () => {
    expect(formatResistance(999)).toBe('999 Ω')
    expect(formatResistance(1000)).toBe('1 kΩ')
    expect(formatResistance(999e3)).toBe('999 kΩ')
    expect(formatResistance(1000e3)).toBe('1 MΩ')
  })
})

describe('formatFrequency', () => {
  it('should format zero value', () => {
    expect(formatFrequency(0)).toBe('0 Hz')
  })

  it('should format hertz range', () => {
    expect(formatFrequency(1)).toBe('1 Hz')
    expect(formatFrequency(50)).toBe('50 Hz')
    expect(formatFrequency(100)).toBe('100 Hz')
    expect(formatFrequency(999)).toBe('999 Hz')
  })

  it('should format kilohertz range', () => {
    expect(formatFrequency(1e3)).toBe('1 kHz')
    expect(formatFrequency(10e3)).toBe('10 kHz')
    expect(formatFrequency(44.1e3)).toBe('44.1 kHz')
  })

  it('should format megahertz range', () => {
    expect(formatFrequency(1e6)).toBe('1 MHz')
    expect(formatFrequency(10e6)).toBe('10 MHz')
    expect(formatFrequency(2.4e6)).toBe('2.4 MHz')
  })

  it('should handle boundary values', () => {
    expect(formatFrequency(999)).toBe('999 Hz')
    expect(formatFrequency(1000)).toBe('1 kHz')
    expect(formatFrequency(999e3)).toBe('999 kHz')
    expect(formatFrequency(1000e3)).toBe('1 MHz')
  })
})

describe('convertToHz', () => {
  it('should convert Hz (identity)', () => {
    expect(convertToHz(1000, 'Hz')).toBe(1000)
    expect(convertToHz(0, 'Hz')).toBe(0)
  })

  it('should convert kHz to Hz', () => {
    expect(convertToHz(1, 'kHz')).toBe(1000)
    expect(convertToHz(44.1, 'kHz')).toBe(44100)
    expect(convertToHz(0, 'kHz')).toBe(0)
  })

  it('should convert MHz to Hz', () => {
    expect(convertToHz(1, 'MHz')).toBe(1000000)
    expect(convertToHz(2.4, 'MHz')).toBe(2400000)
    expect(convertToHz(0, 'MHz')).toBe(0)
  })
})
