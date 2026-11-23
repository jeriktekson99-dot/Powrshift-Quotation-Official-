import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database, SavedRecordInsert } from './src/types/supabase.ts';
import {
  buildCalculatorQuotationInsert,
  mapSupabaseRowToPayload,
  type QuotationPayload,
  type SavedRecordWithQuotation,
} from './src/lib/quotationMapper.ts';

function getServerSupabase() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!url || !key) return null;
  return createClient<Database>(url, key);
}

async function insertQuotationPair(
  supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
  payload: QuotationPayload
): Promise<{ record: QuotationPayload | null; error?: string }> {
  const quotationInsert = buildCalculatorQuotationInsert(payload);
  const { data: createdQuotation, error: quotationError } = await supabase
    .from('calculator_quotations')
    .insert(quotationInsert)
    .select()
    .single();

  if (quotationError || !createdQuotation) {
    return {
      record: null,
      error: quotationError?.message || 'Failed to insert calculator_quotations',
    };
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
    await supabase
      .from('calculator_quotations')
      .delete()
      .eq('id', createdQuotation.id);
    return {
      record: null,
      error: recordError?.message || 'Failed to insert saved_records',
    };
  }

  return {
    record: mapSupabaseRowToPayload({
      ...createdRecord,
      calculator_quotations: createdQuotation,
    }),
  };
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/quotations', async (_req: Request, res: Response) => {
    const supabase = getServerSupabase();
    if (!supabase) {
      return res.json({ configured: false, records: null });
    }

    try {
      const { data, error } = await supabase
        .from('saved_records')
        .select('*, calculator_quotations(*)')
        .order('saved_at', { ascending: false });

      if (error) {
        return res.status(500).json({
          configured: true,
          records: null,
          error: error.message,
        });
      }

      const rows = (data ?? []) as unknown as SavedRecordWithQuotation[];
      return res.json({
        configured: true,
        records: rows.map(mapSupabaseRowToPayload),
      });
    } catch (err) {
      return res.status(500).json({
        configured: true,
        records: null,
        error: err instanceof Error ? err.message : 'Supabase fetch failed',
      });
    }
  });

  app.post('/api/quotations', async (req: Request, res: Response) => {
    const supabase = getServerSupabase();
    if (!supabase) {
      return res.json({ configured: false, record: null });
    }

    const payload = req.body as QuotationPayload | undefined;
    if (!payload || typeof payload !== 'object') {
      return res
        .status(400)
        .json({ configured: true, record: null, error: 'Invalid quotation payload' });
    }

    try {
      const result = await insertQuotationPair(supabase, payload);
      if (!result.record) {
        return res.status(500).json({
          configured: true,
          record: null,
          error: result.error,
        });
      }
      return res.status(201).json({
        configured: true,
        record: result.record,
      });
    } catch (err) {
      return res.status(500).json({
        configured: true,
        record: null,
        error: err instanceof Error ? err.message : 'Supabase save failed',
      });
    }
  });

  app.post('/api/quotations/restore', async (req: Request, res: Response) => {
    const supabase = getServerSupabase();
    if (!supabase) {
      return res.json({ configured: false, records: null });
    }

    const defaults = Array.isArray(req.body?.defaults)
      ? (req.body.defaults as QuotationPayload[])
      : [];
    if (defaults.length === 0) {
      return res
        .status(400)
        .json({ configured: true, records: null, error: 'Missing default records' });
    }

    try {
      const inserted: QuotationPayload[] = [];
      for (const item of [...defaults].reverse()) {
        const result = await insertQuotationPair(supabase, item);
        if (!result.record) {
          return res.status(500).json({
            configured: true,
            records: null,
            error: result.error,
          });
        }
        inserted.unshift(result.record);
      }
      return res.json({ configured: true, records: inserted });
    } catch (err) {
      return res.status(500).json({
        configured: true,
        records: null,
        error: err instanceof Error ? err.message : 'Supabase restore failed',
      });
    }
  });

  app.delete('/api/quotations/:id', async (req: Request, res: Response) => {
    const supabase = getServerSupabase();
    if (!supabase) {
      return res.json({ configured: false, deleted: false });
    }

    const recordId = String(req.params.id || '').trim();
    const quotationId =
      typeof req.query.quotationId === 'string'
        ? req.query.quotationId.trim()
        : '';

    if (!recordId) {
      return res
        .status(400)
        .json({ configured: true, deleted: false, error: 'Missing record ID' });
    }

    try {
      if (quotationId) {
        const { error } = await supabase
          .from('calculator_quotations')
          .delete()
          .eq('id', quotationId);
        if (error) {
          return res.status(500).json({
            configured: true,
            deleted: false,
            error: error.message,
          });
        }
        return res.json({ configured: true, deleted: true });
      }

      const { error } = await supabase
        .from('saved_records')
        .delete()
        .eq('id', recordId);
      if (error) {
        return res.status(500).json({
          configured: true,
          deleted: false,
          error: error.message,
        });
      }
      return res.json({ configured: true, deleted: true });
    } catch (err) {
      return res.status(500).json({
        configured: true,
        deleted: false,
        error: err instanceof Error ? err.message : 'Supabase delete failed',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`PowerShift server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
