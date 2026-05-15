/**
 * POST /api/participants/import
 * Accepts multipart/form-data with a single CSV file.
 *
 * Expected CSV columns:
 *   name*       full name
 *   email*      unique email address
 *   phone       optional
 *   college     maps to organization column
 *   reg_id      optional — auto-generated as REG-XXXX if blank
 *
 * For each valid row:
 *   - Generates qr_code = "SP_" + crypto.randomBytes(16).toString("hex")
 *   - Upserts by email (skips duplicates, doesn't overwrite qr_code)
 *
 * Returns: { imported, skipped, failed, errors[] }
 */
import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'

interface CsvRow {
  name?: string
  email?: string
  phone?: string
  college?: string
  organization?: string
  reg_id?: string
  [key: string]: string | undefined
}

interface ImportError {
  row: number
  email: string
  reason: string
}

function generateToken(): string {
  return 'SP_' + randomBytes(16).toString('hex')
}

function generateRegId(index: number): string {
  return 'REG-' + String(index).padStart(4, '0')
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Auth + role check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Parse multipart form
  let text: string
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    if (!file.name.endsWith('.csv')) return NextResponse.json({ error: 'File must be a .csv' }, { status: 400 })
    text = await file.text()
  } catch {
    return NextResponse.json({ error: 'Failed to read uploaded file' }, { status: 400 })
  }

  // Parse CSV
  const { data: rows, errors: parseErrors } = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  if (parseErrors.length > 0 && rows.length === 0) {
    return NextResponse.json({ error: 'CSV parse failed', details: parseErrors }, { status: 400 })
  }

  // Validate required columns exist
  const sampleRow = rows[0] ?? {}
  if (!('name' in sampleRow) || !('email' in sampleRow)) {
    return NextResponse.json({
      error: 'CSV must have at least "name" and "email" columns',
      found: Object.keys(sampleRow),
    }, { status: 400 })
  }

  // Fetch existing emails to detect duplicates efficiently
  const { data: existing } = await supabase.from('participants').select('email')
  const existingEmails = new Set((existing ?? []).map(e => e.email.toLowerCase()))

  // Find highest existing reg_id number for auto-generation
  const { data: existingRegs } = await supabase
    .from('participants').select('reg_id').not('reg_id', 'is', null)
  let regCounter = 1
  for (const r of existingRegs ?? []) {
    if (r.reg_id) {
      const n = parseInt(r.reg_id.replace(/\D/g, ''), 10)
      if (!isNaN(n) && n >= regCounter) regCounter = n + 1
    }
  }

  const errors: ImportError[] = []
  const toInsert: {
    name: string; email: string; phone: string | null
    organization: string | null; reg_id: string; qr_code: string
  }[] = []
  let skipped = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed + header row

    const name = row.name?.trim() ?? ''
    const email = (row.email?.trim() ?? '').toLowerCase()
    const phone = row.phone?.trim() || null
    const org = (row.college ?? row.organization ?? '').trim() || null
    const regId = row.reg_id?.trim() || generateRegId(regCounter++)

    if (!name) {
      errors.push({ row: rowNum, email, reason: 'Missing required field: name' })
      continue
    }
    if (!email) {
      errors.push({ row: rowNum, email: '(blank)', reason: 'Missing required field: email' })
      continue
    }
    if (!isValidEmail(email)) {
      errors.push({ row: rowNum, email, reason: 'Invalid email format' })
      continue
    }
    if (existingEmails.has(email)) {
      skipped++
      continue
    }

    existingEmails.add(email) // prevent duplicates within same CSV
    toInsert.push({
      name,
      email,
      phone,
      organization: org,
      reg_id: regId,
      qr_code: generateToken(),
    })
  }

  // Batch insert in chunks of 50
  let imported = 0
  const CHUNK = 50
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK)
    const { error: insertError, data } = await supabase
      .from('participants')
      .insert(chunk as any)
      .select('id')
    if (insertError) {
      // Log chunk failure as individual errors
      chunk.forEach((r) => errors.push({ row: -1, email: r.email, reason: insertError.message }))
    } else {
      imported += data?.length ?? chunk.length
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    failed: errors.length,
    total: rows.length,
    errors,
  })
}
