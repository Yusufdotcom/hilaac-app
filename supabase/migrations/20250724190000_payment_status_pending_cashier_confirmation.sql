-- Safe idempotent add of pending_cashier_confirmation to payment_status ENUM.
-- Run via: supabase db push  OR paste into Supabase SQL Editor.

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'pending_cashier_confirmation';
