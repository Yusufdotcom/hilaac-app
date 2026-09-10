-- V3 Part 1.1 — Add Somali Airlines subscription tier (additive only).
-- Existing goronyo / gorgor / galeyr / starter / pro / trial unchanged.
-- No restaurant rows are updated by this migration.

ALTER TYPE public.subscription_tier ADD VALUE IF NOT EXISTS 'somali_airlines';

COMMENT ON TYPE public.subscription_tier IS
  'trial | starter | pro (legacy) | goronyo | gorgor | galeyr | somali_airlines. Legacy values remain until Step 1.8.';
