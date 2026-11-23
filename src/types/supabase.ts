export type BillMode = 'KWH' | 'BILL';
export type HardwareConfigMode = 'STANDARD' | 'ADVANCED';

/**
 * Type 1: Calculator Input Quotation & System Self-Sufficiency Performance
 * Maps to `public.calculator_quotations` in Supabase.
 */
export type CalculatorQuotation = {
  id: string;

  // 1. Client Information
  client_full_name: string;
  contact_phone: string;
  email_address: string;
  proposal_date: string;
  site_location_address: string;
  quote_reference: string;
  engineer_name: string;

  // 2. Tariff & Usage Configuration
  electricity_rate: number;
  monthly_electricity_usage: number;
  monthly_bill: number;
  bill_mode: BillMode;

  // 3. Active Hardware Configuration (Standard dropdown & Advanced numeric inputs)
  config_mode: HardwareConfigMode;
  solar_package_id: string;
  solar_package_name: string;
  installed_solar_kwp: number;
  battery_capacity_kwh: number;
  daytime_load_percent: number;
  nighttime_load_percent: number;

  // Advanced Engineering Multipliers
  peak_sun_hours: number;
  dod_percent: number;
  system_loss_buffer_percent: number;
  derate_factor_percent: number;
  cost_per_kwp: number;
  cost_per_battery_kwh: number;

  // 4A. System Self-Sufficiency & Performance: Daily Power Balance
  monthly_usage_kwh: number;
  average_daily_load_kwh: number;
  daytime_load_kwh: number;
  nighttime_load_kwh: number;
  recommended_size_after_loss_kwp: number;
  est_daily_solar_generation_kwh: number;
  est_monthly_solar_generation_kwh: number;

  // 4B. System Self-Sufficiency & Performance: Battery Storage Performance
  installed_capacity_kwh: number;
  usable_battery_kwh: number;
  reserve_capacity_kwh: number;
  nighttime_energy_needed_kwh: number;
  grid_import_required_kwh: number;

  // Timestamps
  created_at: string;
  updated_at: string;
};

export type CalculatorQuotationInsert = Omit<
  CalculatorQuotation,
  'id' | 'created_at' | 'updated_at'
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type CalculatorQuotationUpdate = Partial<CalculatorQuotationInsert>;

/**
 * Type 2: Saved Records
 * Maps to `public.saved_records` in Supabase.
 */
export type SavedRecord = {
  id: string;
  quotation_id: string | null;

  // Saved Record Summary Fields
  name: string;
  reference_number: string;
  address: string;
  phone_number: string;
  email: string;
  battery_storage: number;
  dod_percent: number;
  package: string;
  installed_solar_kwp: number;

  // Timestamps
  saved_at: string;
  created_at: string;
  updated_at: string;
};

export type SavedRecordInsert = Omit<
  SavedRecord,
  'id' | 'created_at' | 'updated_at'
> & {
  id?: string;
  saved_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type SavedRecordUpdate = Partial<SavedRecordInsert>;

/**
 * Typed Supabase Database definition for createClient<Database>()
 */
export type Database = {
  public: {
    Tables: {
      calculator_quotations: {
        Row: CalculatorQuotation;
        Insert: CalculatorQuotationInsert;
        Update: CalculatorQuotationUpdate;
        Relationships: [];
      };
      saved_records: {
        Row: SavedRecord;
        Insert: SavedRecordInsert;
        Update: SavedRecordUpdate;
        Relationships: [
          {
            foreignKeyName: 'saved_records_quotation_id_fkey';
            columns: ['quotation_id'];
            isOneToOne: false;
            referencedRelation: 'calculator_quotations';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
