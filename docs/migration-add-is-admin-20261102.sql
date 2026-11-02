-- Migration: Add is_admin column to profiles
-- Purpose: Track admin users for audit log permissions
-- Date: 2026-11-02

alter table public.profiles
  add column if not exists is_admin boolean default false;

comment on column public.profiles.is_admin is 'Whether this user is an administrator with access to audit logs and admin features';

-- Create index for faster lookups
create index if not exists profiles_is_admin_idx on public.profiles(is_admin) where is_admin = true;
