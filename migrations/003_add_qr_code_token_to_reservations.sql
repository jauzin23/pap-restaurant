-- Migration: Add qr_code_token to reservations table
ALTER TABLE reservations ADD COLUMN qr_code_token VARCHAR(255);
