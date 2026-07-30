-- 1. Nuevos valores de enums existentes
ALTER TYPE public.tax_sync_type ADD VALUE IF NOT EXISTS 'demo_connect';
ALTER TYPE public.tax_sync_type ADD VALUE IF NOT EXISTS 'weekly_refresh';
ALTER TYPE public.tax_sync_type ADD VALUE IF NOT EXISTS 'retry';
ALTER TYPE public.tax_sync_status ADD VALUE IF NOT EXISTS 'skipped';
ALTER TYPE public.tax_data_source ADD VALUE IF NOT EXISTS 'mock_gateway';