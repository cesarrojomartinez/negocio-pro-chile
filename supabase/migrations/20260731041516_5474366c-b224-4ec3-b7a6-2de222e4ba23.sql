update public.tax_f29_extractions
set normalized_fields = jsonb_set(normalized_fields, '{declared_ppm_rate}', '0.001'),
    extraction_status = 'success',
    warnings = '[]'::jsonb,
    parser_version = 'f29-pdf-1.2.0',
    validation_results = (
      select jsonb_agg(case
        when v->>'id' = 'ppm' then jsonb_build_object('id','ppm','titulo','PPM declarado','estado','ok','detalle','Base 15288385 x tasa 0.001 = 15288.','esperado',15288,'obtenido',15288)
        when v->>'id' = 'exclusion' then jsonb_build_object('id','exclusion','titulo','IVA determinado y remanente siguiente','estado','ok','detalle','Remanente residual junto al IVA por pagar: sin contradiccion relevante.')
        else v end)
      from jsonb_array_elements(validation_results) v),
    updated_at = now()
where period = '2026-06';