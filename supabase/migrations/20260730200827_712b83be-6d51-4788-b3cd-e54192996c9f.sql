ALTER TYPE public.tax_period_status ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE public.tax_period_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.tax_period_status ADD VALUE IF NOT EXISTS 'reopened';
ALTER TYPE public.tax_alert_type ADD VALUE IF NOT EXISTS 'period_ready_to_close';
ALTER TYPE public.tax_alert_type ADD VALUE IF NOT EXISTS 'f29_confirmation_pending';
ALTER TYPE public.tax_alert_type ADD VALUE IF NOT EXISTS 'weekly_update_due';
ALTER TYPE public.tax_alert_type ADD VALUE IF NOT EXISTS 'declared_vs_estimated_difference';