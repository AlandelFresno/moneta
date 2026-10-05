import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { LemonPdfParserService } from './lemon-pdf-parser.service';

describe('LemonPdfParserService', () => {
  let service: LemonPdfParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(LemonPdfParserService);
  });

  it('returns lemon as the source', () => {
    expect(service.parseLines([]).source).toBe('lemon');
  });

  it('parses a confirmed purchase row as an expense', () => {
    const lines = ['Compra con Tarjeta Confirmada EL ECONOMO 19/03/2024 13:06 663786 2602905066 $ 3,040.00 $ 3,040.00'];

    const result = service.parseLines(lines);

    expect(result.rows.length).toBe(1);
    const row = result.rows[0];
    expect(row.type).toBe('expense');
    expect(row.name).toBe('EL ECONOMO');
    expect(row.amount).toBe(3040);
    expect(row.date.getFullYear()).toBe(2024);
    expect(row.date.getMonth()).toBe(2); // March
    expect(row.date.getDate()).toBe(19);
    expect(row.date.getHours()).toBe(13);
    expect(row.date.getMinutes()).toBe(6);
  });

  it('parses an approved purchase row (different status word) as an expense', () => {
    const lines = ['Compra con Tarjeta Aprobada MERPAGO*SRKIOSQUERO 09/07/2026 16:29 1 2 $ 12,800.00 $ 12,800.00'];

    const result = service.parseLines(lines);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].name).toBe('MERPAGO*SRKIOSQUERO');
    expect(result.rows[0].amount).toBe(12800);
  });

  it('parses a refund row (no status word at all) as income', () => {
    const lines = ['Devolución de Compra DISCORD* TEMPORARYAUTH 26/01/2026 17:40 194392 $ 10,320.86 $ 10,320.86 USD 5.15'];

    const result = service.parseLines(lines);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].type).toBe('income');
    expect(result.rows[0].name).toBe('DISCORD* TEMPORARYAUTH');
    expect(result.rows[0].amount).toBe(10320.86);
  });

  it('ignores the TOTALES summary row', () => {
    const lines = ['TOTALES $ 7,104,818.66 $ 6,888,361.84 USD 714.52 $ 1,263.61 $ 114,234.47 $ 0.00 $ 145,924.46 $ 13,897.57'];

    expect(service.parseLines(lines).rows.length).toBe(0);
  });

  it('ignores unrelated lines with no date/time token', () => {
    const lines = ['DETALLE ESTADO COMERCIO FECHA CODIGO DE AUTORIZACION COMPROBANTE MONTO TOTAL'];

    expect(service.parseLines(lines).rows.length).toBe(0);
  });
});
