import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, SavedRecordInsert } from '../types/supabase';
import {
  buildCalculatorQuotationInsert,
  mapSupabaseRowToPayload,
  type QuotationPayload,
  type SavedRecordWithQuotation,
} from './quotationMapper';

export type { QuotationPayload } from './quotationMapper';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseClientConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

export const supabase: SupabaseClient<Database> | null =
  isSupabaseClientConfigured()
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : null;

export interface SupabaseFetchResult {
  configured: boolean;
  records: QuotationPayload[] | null;
  error?: string;
}

export interface SupabaseSaveResult {
  configured: boolean;
  record: QuotationPayload | null;
  error?: string;
}

export interface SupabaseDeleteResult {
  configured: boolean;
  deleted: boolean;
  error?: string;
}

/**
 * Fetches saved quotation records via /api/quotations (server-side Supabase)
 * with fallback to direct client-side Supabase if configured.
 */
export async function fetchQuotationsFromSupabase(): Promise<SupabaseFetchResult> {
  try {
    const res = await fetch('/api/quotations');
    if (res.ok || res.status === 500) {
      const json = (await res.json()) as SupabaseFetchResult;
      if (json.configured) {
        return json;
      }
    }
  } catch {
    // Fall through to direct client check if API route is unavailable
  }

  if (!supabase) {
    return { configured: false, records: null };
  }

  try {
    const { data, error } = await supabase
      .from('saved_records')
      .select('*, calculator_quotations(*)')
      .order('saved_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch saved_records error:', error.message);
      return { configured: true, records: null, error: error.message };
    }

    const rows = (data ?? []) as unknown as SavedRecordWithQuotation[];
    return { configured: true, records: rows.map(mapSupabaseRowToPayload) };
  } catch (err) {
    console.error('Supabase fetch error:', err);
    return {
      configured: true,
      records: null,
      error: err instanceof Error ? err.message : 'Supabase fetch failed',
    };
  }
}

/**
 * Saves both Type 1 (`calculator_quotations`) and Type 2 (`saved_records`) in Supabase.
 */
export async function saveQuotationToSupabase(
  payload: QuotationPayload
): Promise<SupabaseSaveResult> {
  try {
    const res = await fetch('/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok || res.status === 500 || res.status === 400) {
      const json = (await res.json()) as SupabaseSaveResult;
      if (json.configured) {
        return json;
      }
    }
  } catch {
    // Fall through to direct client check if API route is unavailable
  }

  if (!supabase) {
    return { configured: false, record: null };
  }

  try {
    const quotationInsert = buildCalculatorQuotationInsert(payload);
    const { data: createdQuotation, error: quotationError } = await supabase
      .from('calculator_quotations')
      .insert(quotationInsert)
      .select()
      .single();

    if (quotationError || !createdQuotation) {
      const message = quotationError?.message || 'Failed to save quotation';
      console.error('Supabase insert calculator_quotations error:', message);
      return { configured: true, record: null, error: message };
    }

    const savedRecordInsert: SavedRecordInsert = {
      quotation_id: createdQuotation.id,
      name: createdQuotation.client_full_name,
      reference_number: createdQuotation.quote_reference,
      address: createdQuotation.site_location_address,
      phone_number: createdQuotation.contact_phone,
      email: createdQuotation.email_address,
      battery_storage: Number(createdQuotation.battery_capacity_kwh),
      dod_percent: Number(createdQuotation.dod_percent),
      package: createdQuotation.solar_package_name,
      installed_solar_kwp: Number(createdQuotation.installed_solar_kwp),
      saved_at: new Date().toISOString(),
    };

    const { data: createdRecord, error: recordError } = await supabase
      .from('saved_records')
      .insert(savedRecordInsert)
      .select()
      .single();

    if (recordError || !createdRecord) {
      const message = recordError?.message || 'Failed to save record';
      console.error('Supabase insert saved_records error:', message);
      await supabase
        .from('calculator_quotations')
        .delete()
        .eq('id', createdQuotation.id);
      return { configured: true, record: null, error: message };
    }

    return {
      configured: true,
      record: mapSupabaseRowToPayload({
        ...createdRecord,
        calculator_quotations: createdQuotation,
      }),
    };
  } catch (err) {
    console.error('Supabase save error:', err);
    return {
      configured: true,
      record: null,
      error: err instanceof Error ? err.message : 'Supabase save failed',
    };
  }
}

/**
 * Deletes a saved record (and its linked calculator_quotations row) from Supabase.
 */
export async function deleteQuotationFromSupabase(
  recordId: string,
  quotationId?: string
): Promise<SupabaseDeleteResult> {
  try {
    const query = quotationId
      ? `?quotationId=${encodeURIComponent(quotationId)}`
      : '';
    const res = await fetch(
      `/api/quotations/${encodeURIComponent(recordId)}${query}`,
      { method: 'DELETE' }
    );
    if (res.ok || res.status === 500 || res.status === 400) {
      const json = (await res.json()) as SupabaseDeleteResult;
      if (json.configured) {
        return json;
      }
    }
  } catch {
    // Fall through to direct client check if API route is unavailable
  }

  if (!supabase) {
    return { configured: false, deleted: false };
  }

  try {
    if (quotationId) {
      const { error } = await supabase
        .from('calculator_quotations')
        .delete()
        .eq('id', quotationId);
      if (error) {
        console.error(
          'Supabase delete calculator_quotations error:',
          error.message
        );
        return { configured: true, deleted: false, error: error.message };
      }
      return { configured: true, deleted: true };
    }

    const { error } = await supabase
      .from('saved_records')
      .delete()
      .eq('id', recordId);

    if (error) {
      console.error('Supabase delete saved_records error:', error.message);
      return { configured: true, deleted: false, error: error.message };
    }
    return { configured: true, deleted: true };
  } catch (err) {
    console.error('Supabase delete error:', err);
    return {
      configured: true,
      deleted: false,
      error: err instanceof Error ? err.message : 'Supabase delete failed',
    };
  }
}

/**
 * Seeds sample quotations into Supabase when restoring defaults.
 */
export async function restoreDefaultQuotationsInSupabase(
  defaults: QuotationPayload[]
): Promise<SupabaseFetchResult> {
  try {
    const res = await fetch('/api/quotations/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaults }),
    });
    if (res.ok || res.status === 500 || res.status === 400) {
      const json = (await res.json()) as SupabaseFetchResult;
      if (json.configured) {
        return json;
      }
    }
  } catch {
    // Fall through to direct client check
  }

  if (!supabase) {
    return { configured: false, records: null };
  }

  const inserted: QuotationPayload[] = [];
  for (const item of [...defaults].reverse()) {
    const result = await saveQuotationToSupabase(item);
    if (!result.record) {
      return { configured: true, records: null, error: result.error };
    }
    inserted.unshift(result.record);
  }
  return { configured: true, records: inserted };
}
