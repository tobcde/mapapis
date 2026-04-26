import { describe, it, expect } from 'vitest';
import { fmtMoney, validarDni, normalizarDni } from './fmt';

describe('fmtMoney', () => {
  it('formats integer cents to ARS currency', () => {
    expect(fmtMoney(500000)).toMatch(/5\.000/);
    expect(fmtMoney(0)).toMatch(/0/);
  });

  it('handles bigint input', () => {
    expect(fmtMoney(BigInt(123400))).toMatch(/1\.234/);
  });
});

describe('validarDni', () => {
  it.each([
    ['12345678', true],
    ['1234567', true],
    ['123456', false],
    ['123456789', false],
    ['1234567a', false],
    ['', false],
  ])('validarDni(%s) === %s', (input, expected) => {
    expect(validarDni(input)).toBe(expected);
  });
});

describe('normalizarDni', () => {
  it('strips dots, spaces, and non-digits', () => {
    expect(normalizarDni('12.345.678')).toBe('12345678');
    expect(normalizarDni('12 345 678')).toBe('12345678');
    expect(normalizarDni('abc12d34')).toBe('1234');
  });
});
