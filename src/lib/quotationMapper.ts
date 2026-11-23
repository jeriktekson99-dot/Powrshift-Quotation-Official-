import type {
  BillMode,
  CalculatorQuotation,
  CalculatorQuotationInsert,
  HardwareConfigMode,
  SavedRecord,
} from '../types/supabase.ts';

export interface QuotationPayload {
  id: string;
  quotationId?: string;
  savedAt: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  siteAddress: string;
  quoteReference: string;
  engineerName: string;
  quoteDate: string;
  usageMode: BillMode;
  electricityRate: number;
  monthlyUsageKwh: number;
  billAmountInput: number;
  configTab?: HardwareConfigMode;
  selectedPackageId: string;
  installedSolarKwp: number;
  installedBatteryKwh: number;
  daytimeLoadPercent: number;
  nighttimeLoadPercent: number;
  peakSunHours?: number;
  dodPercent?: number;
  systemLossBuffer?: number;
  derateFactor?: number;
  costPerKwp?: number;
  costPerBatteryKwh?: number;
  packageName?: string;
  // Computed System Self-Sufficiency & Performance metrics
  averageDailyLoadKwh?: number;
  daytimeLoadKwh?: number;
  nighttimeLoadKwh?: number;
  recommendedSizeAfterLossKwp?: number;
  estDailySolarGenerationKwh?: number;
  estMonthlySolarGenerationKwh?: number;
  usableBatteryKwh?: number;
  reserveCapacityKwh?: number;
  gridImportRequiredKwh?: number;
}

export type SavedRecordWithQuotation = SavedRecord & {
  calculator_quotations: CalculatorQuotation | null;
};

export function formatDisplayTimestamp(isoOrText?: string): string {
  if (!isoOrText) {
    return new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  const parsed = Date.parse(isoOrText);
  if (Number.isNaN(parsed)) return isoOrText;
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildCalculatorQuotationInsert(
  payload: QuotationPayload
): CalculatorQuotationInsert {
  const days = 30;
  const elecRate = Number(payload.electricityRate) || 12;
  const monthlyKwh = Number(payload.monthlyUsageKwh) || 0;
  const usageMode: BillMode = payload.usageMode === 'BILL' ? 'BILL' : 'KWH';
  const monthlyBill =
    usageMode === 'BILL'
      ? Number(payload.billAmountInput) || monthlyKwh * elecRate
      : monthlyKwh * elecRate;
  const solarKwp = Number(payload.installedSolarKwp) || 0;
  const batteryKwh = Number(payload.installedBatteryKwh) || 0;
  const daytimePct = Number.isFinite(Number(payload.daytimeLoadPercent))
    ? Number(payload.daytimeLoadPercent)
    : 40;
  const nighttimePct = Number.isFinite(Number(payload.nighttimeLoadPercent))
    ? Number(payload.nighttimeLoadPercent)
    : 60;
  const peakSunHours = Number(payload.peakSunHours) || 5.0;
  const dodPercent = Number(payload.dodPercent) || 80;
  const systemLossBuffer = Number(payload.systemLossBuffer) || 20;
  const derateFactor = Number(payload.derateFactor) || 15;
  const costPerKwp = Number(payload.costPerKwp) || 52000;
  const costPerBatteryKwh = Number(payload.costPerBatteryKwh) || 18500;

  const avgDailyLoad =
    payload.averageDailyLoadKwh ?? Number((monthlyKwh / days).toFixed(2));
  const daytimeLoadKwh =
    payload.daytimeLoadKwh ??
    Number(((monthlyKwh / days) * (daytimePct / 100)).toFixed(2));
  const nighttimeLoadKwh =
    payload.nighttimeLoadKwh ??
    Number(((monthlyKwh / days) * (nighttimePct / 100)).toFixed(2));
  const recommendedSizeAfterLossKwp =
    payload.recommendedSizeAfterLossKwp ??
    Number((solarKwp * 1.2).toFixed(2));

  const efficiencyLossRatio = derateFactor / 100;
  const estDailySolarGen =
    payload.estDailySolarGenerationKwh ??
    Number((solarKwp * (1 - efficiencyLossRatio) * peakSunHours).toFixed(2));
  const estMonthlySolarGen =
    payload.estMonthlySolarGenerationKwh ??
    Number((estDailySolarGen * days).toFixed(2));

  const dodRatio = dodPercent / 100;
  const usableBattery =
    payload.usableBatteryKwh ?? Number((batteryKwh * dodRatio).toFixed(2));
  const reserveCapacity =
    payload.reserveCapacityKwh ??
    Number((batteryKwh * (1 - dodRatio)).toFixed(2));
  const gridImportRequired =
    payload.gridImportRequiredKwh ??
    Number(Math.max(0, nighttimeLoadKwh - usableBattery).toFixed(2));

  const configMode: HardwareConfigMode =
    payload.configTab === 'ADVANCED' ? 'ADVANCED' : 'STANDARD';

  return {
    client_full_name: String(payload.clientName || '').trim() || 'Unnamed Client',
    contact_phone: String(payload.clientPhone || ''),
    email_address: String(payload.clientEmail || ''),
    proposal_date: String(payload.quoteDate || ''),
    site_location_address: String(payload.siteAddress || ''),
    quote_reference: String(payload.quoteReference || 'PS-2026-0000'),
    engineer_name:
      String(payload.engineerName || '') ||
      'Engr. M. Ramos (Lead Systems Architect)',
    electricity_rate: elecRate,
    monthly_electricity_usage: monthlyKwh,
    monthly_bill: Number(monthlyBill.toFixed(2)),
    bill_mode: usageMode,
    config_mode: configMode,
    solar_package_id: String(payload.selectedPackageId || 'pkg-custom'),
    solar_package_name: String(payload.packageName || `${solarKwp}kW Package`),
    installed_solar_kwp: solarKwp,
    battery_capacity_kwh: batteryKwh,
    daytime_load_percent: daytimePct,
    nighttime_load_percent: nighttimePct,
    peak_sun_hours: peakSunHours,
    dod_percent: dodPercent,
    system_loss_buffer_percent: systemLossBuffer,
    derate_factor_percent: derateFactor,
    cost_per_kwp: costPerKwp,
    cost_per_battery_kwh: costPerBatteryKwh,
    monthly_usage_kwh: monthlyKwh,
    average_daily_load_kwh: avgDailyLoad,
    daytime_load_kwh: daytimeLoadKwh,
    nighttime_load_kwh: nighttimeLoadKwh,
    recommended_size_after_loss_kwp: recommendedSizeAfterLossKwp,
    est_daily_solar_generation_kwh: estDailySolarGen,
    est_monthly_solar_generation_kwh: estMonthlySolarGen,
    installed_capacity_kwh: batteryKwh,
    usable_battery_kwh: usableBattery,
    reserve_capacity_kwh: reserveCapacity,
    nighttime_energy_needed_kwh: nighttimeLoadKwh,
    grid_import_required_kwh: gridImportRequired,
  };
}

export function mapSupabaseRowToPayload(
  row: SavedRecordWithQuotation
): QuotationPayload {
  const q = row.calculator_quotations;
  return {
    id: row.id,
    quotationId: row.quotation_id ?? q?.id,
    savedAt: formatDisplayTimestamp(row.saved_at),
    clientName: q?.client_full_name ?? row.name,
    clientEmail: q?.email_address ?? row.email,
    clientPhone: q?.contact_phone ?? row.phone_number,
    siteAddress: q?.site_location_address ?? row.address,
    quoteReference: q?.quote_reference ?? row.reference_number,
    engineerName: q?.engineer_name ?? 'Engr. M. Ramos (Lead Systems Architect)',
    quoteDate:
      q?.proposal_date ??
      new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    usageMode: q?.bill_mode ?? 'KWH',
    electricityRate: Number(q?.electricity_rate ?? 12.0),
    monthlyUsageKwh: Number(q?.monthly_electricity_usage ?? 940),
    billAmountInput: Number(q?.monthly_bill ?? 11280),
    configTab: q?.config_mode ?? 'STANDARD',
    selectedPackageId: q?.solar_package_id ?? 'pkg-custom',
    installedSolarKwp: Number(q?.installed_solar_kwp ?? row.installed_solar_kwp),
    installedBatteryKwh: Number(q?.battery_capacity_kwh ?? row.battery_storage),
    daytimeLoadPercent: Number(q?.daytime_load_percent ?? 40),
    nighttimeLoadPercent: Number(q?.nighttime_load_percent ?? 60),
    peakSunHours: Number(q?.peak_sun_hours ?? 5.0),
    dodPercent: Number(q?.dod_percent ?? row.dod_percent ?? 80),
    systemLossBuffer: Number(q?.system_loss_buffer_percent ?? 20),
    derateFactor: Number(q?.derate_factor_percent ?? 15),
    costPerKwp: Number(q?.cost_per_kwp ?? 52000),
    costPerBatteryKwh: Number(q?.cost_per_battery_kwh ?? 18500),
    packageName: q?.solar_package_name ?? row.package,
    averageDailyLoadKwh: q ? Number(q.average_daily_load_kwh) : undefined,
    daytimeLoadKwh: q ? Number(q.daytime_load_kwh) : undefined,
    nighttimeLoadKwh: q ? Number(q.nighttime_load_kwh) : undefined,
    recommendedSizeAfterLossKwp: q
      ? Number(q.recommended_size_after_loss_kwp)
      : undefined,
    estDailySolarGenerationKwh: q
      ? Number(q.est_daily_solar_generation_kwh)
      : undefined,
    estMonthlySolarGenerationKwh: q
      ? Number(q.est_monthly_solar_generation_kwh)
      : undefined,
    usableBatteryKwh: q ? Number(q.usable_battery_kwh) : undefined,
    reserveCapacityKwh: q ? Number(q.reserve_capacity_kwh) : undefined,
    gridImportRequiredKwh: q ? Number(q.grid_import_required_kwh) : undefined,
  };
}
