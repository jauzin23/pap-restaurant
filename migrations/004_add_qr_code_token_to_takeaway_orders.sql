-- Migration: Add qr_code_token to takeaway_orders table
ALTER TABLE takeaway_orders ADD COLUMN qr_code_token VARCHAR(255);
