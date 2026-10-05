import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MercadoPagoCsvParserService } from './mercadopago-csv-parser.service';

const HEADER =
  'SOURCE_ID;PAYMENT_METHOD_TYPE;TRANSACTION_TYPE;TRANSACTION_AMOUNT;TRANSACTION_DATE;FEE_AMOUNT;SETTLEMENT_DATE;REAL_AMOUNT;TAXES_AMOUNT;BUSINESS_UNIT;SUB_UNIT;MONEY_RELEASE_DATE';

describe('MercadoPagoCsvParserService', () => {
  let service: MercadoPagoCsvParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(MercadoPagoCsvParserService);
  });

  it('throws when the file does not start with the expected header', () => {
    expect(() => service.parseLines(['not,a,valid,header'])).toThrowError();
  });

  it('throws on an empty file', () => {
    expect(() => service.parseLines([])).toThrowError();
  });

  it('parses a negative amount as an expense, named from the payment method type', () => {
    const lines = [HEADER, '164664601156;available_money;SETTLEMENT;-5000.00;2026-06-18T08:20:16.000-03:00;0.00;2026-06-18T08:20:18.000-03:00;-5000.00;0.00;Mercado Pago;Wallet;2026-06-19T08:20:18.000-03:00'];

    const result = service.parseLines(lines);

    expect(result.source).toBe('mercadopago');
    expect(result.rows.length).toBe(1);
    const row = result.rows[0];
    expect(row.type).toBe('expense');
    expect(row.amount).toBe(5000);
    expect(row.name).toBe('MercadoPago (available_money)');
  });

  it('parses a positive amount as income, named from business unit when payment method type is blank', () => {
    const lines = [HEADER, '1745429519444;;SETTLEMENT;345.32;2026-06-18T01:17:20.000-03:00;0.00;2026-06-18T01:17:20.000-03:00;345.32;0.00;Mercado Pago;Wallet;'];

    const result = service.parseLines(lines);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].type).toBe('income');
    expect(result.rows[0].amount).toBe(345.32);
    expect(result.rows[0].name).toBe('MercadoPago (Mercado Pago - Wallet)');
  });

  it('skips a row with a zero amount and reports it as an error', () => {
    const lines = [HEADER, '1;;SETTLEMENT;0.00;2026-06-18T01:17:20.000-03:00;0.00;;0.00;0.00;;;'];

    const result = service.parseLines(lines);

    expect(result.rows.length).toBe(0);
    expect(result.errors.length).toBe(1);
  });

  it('skips a row with an unparseable date and reports it as an error', () => {
    const lines = [HEADER, '1;;SETTLEMENT;100.00;not-a-date;0.00;;100.00;0.00;;;'];

    const result = service.parseLines(lines);

    expect(result.rows.length).toBe(0);
    expect(result.errors.length).toBe(1);
  });

  it('falls back to a plain transaction-type label when both payment method and business unit are blank', () => {
    const lines = [HEADER, '1;;CASHBACK;50.00;2026-06-18T01:17:20.000-03:00;0.00;;50.00;0.00;;;'];

    const result = service.parseLines(lines);

    expect(result.rows[0].name).toBe('MercadoPago CASHBACK');
  });
});
