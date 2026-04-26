-- =========================================================================
-- 023_fix_centavos_units.sql — Migración correctiva de unidades monetarias
-- =========================================================================
-- Problema: el FE guardaba valores en pesos (no en centavos) en columnas
-- *_centavos, pero MP cobraba dividiendo /100 → terminó cobrando 1/100 del
-- precio real ($45.000 oferta → $450 charge).
--
-- Fix de código (FE):
--   - crearOferta y crear_necesidad ahora multiplican por 100 al insertar.
--   - fmtMoney() divide por 100 al mostrar.
--
-- Esta migración multiplica *100 los datos existentes para que pasen a
-- estar realmente en centavos. Solo se debe correr UNA vez. Los datos
-- son de prueba (jardín propio + tests), no hay producción.
-- =========================================================================

begin;

-- Ofertas
update public.ofertas
set precio_total_centavos = precio_total_centavos * 100
where precio_total_centavos is not null;

-- Necesidades (presupuesto min/max)
update public.necesidades
set presupuesto_min_centavos = presupuesto_min_centavos * 100
where presupuesto_min_centavos is not null;

update public.necesidades
set presupuesto_max_centavos = presupuesto_max_centavos * 100
where presupuesto_max_centavos is not null;

-- Pagos individuales (registrar_pago) — cierra el round-trip por si quedaron
update public.necesidad_pagos
set monto_centavos = monto_centavos * 100
where monto_centavos is not null;

-- Pagos MP — solo los pendientes/aprobados que reflejan ofertas viejas;
-- aprobados ya cobrados quedan como histórico distorsionado pero al menos
-- el monto registrado se alinea con el resto de la app.
update public.pago_mp
set monto_centavos = monto_centavos * 100;

commit;
