import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SantanderPdfParserService } from './santander-pdf-parser.service';

describe('SantanderPdfParserService', () => {
  let service: SantanderPdfParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(SantanderPdfParserService);
  });

  it('returns santander as the source', () => {
    const result = service.parseLines([]);
    expect(result.source).toBe('santander');
  });

  it('skips the opening-balance row (two account columns + saldo = 3 money tokens)', () => {
    const lines = ['20/06/24                            Saldo Inicial                                                              $ 73.359,24                       $ 0,00          $ 73.359,24'];

    const result = service.parseLines(lines);

    expect(result.rows.length).toBe(0);
  });

  it('parses an expense row, merging the counterparty continuation line and stripping the receipt number', () => {
    const lines = [
      '24/06/24 55531293                   Compra con tarjeta de debito                                              -$ 36.164,85                       $ 37.194,39',
      '                                    Market mar del plata - tarj nro. 1089'
    ];

    const result = service.parseLines(lines);

    expect(result.rows.length).toBe(1);
    const row = result.rows[0];
    expect(row.type).toBe('expense');
    expect(row.amount).toBe(36164.85);
    expect(row.name).toBe('Compra con tarjeta de debito - Market mar del plata - tarj nro. 1089');
    expect(row.date.getFullYear()).toBe(2024);
    expect(row.date.getMonth()).toBe(5); // June, 0-indexed
    expect(row.date.getDate()).toBe(24);
  });

  it('parses an income row (positive signed amount)', () => {
    const lines = [
      '25/06/24 78688735                   Transferencia recibida                                                      $ 9.290,62                       $ 42.985,01',
      '                                    De alan mariano del fresn / - var / 20422358871'
    ];

    const result = service.parseLines(lines);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].type).toBe('income');
    expect(result.rows[0].amount).toBe(9290.62);
  });

  it('does not merge a continuation line when the next line is the repeated table header', () => {
    const lines = [
      '03/07/24                   Pago de tarjeta de credito                                        -$ 129.532,19                                   $ 395.779,03',
      'Fecha    Comprobante    Movimiento                                               Caja de Ahorro en pesos   Cuenta Corriente en pesos      Saldo en cuenta'
    ];

    const result = service.parseLines(lines);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].name).toBe('Pago de tarjeta de credito');
  });

  it('ignores an unrelated single-amount row, like the installment-purchase detail table further down the statement', () => {
    const lines = ['11/05/24                   462289           Yenny mar del plata                               03 de 03        $ 11.799,66'];

    const result = service.parseLines(lines);

    expect(result.rows.length).toBe(0);
  });

  it('ignores lines that do not start with a date', () => {
    const lines = ['Movimientos en pesos', 'Banco Santander Argentina S.A. es una sociedad anónima...'];

    const result = service.parseLines(lines);

    expect(result.rows.length).toBe(0);
  });
});
