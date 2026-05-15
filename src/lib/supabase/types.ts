/**
 * TypeScript types auto-generated from Supabase schema.
 *
 * HOW TO REGENERATE:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts
 *
 * For now this is hand-written to match the SQL schema exactly.
 */

export type UserRole = 'admin' | 'scanner' | 'viewer'
export type AttendanceStatus = 'present' | 'absent' | 'late'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: UserRole
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: UserRole
          updated_at?: string
        }
      }
      participants: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          organization: string | null
          qr_code: string
          qr_revoked_at: string | null
          qr_version: number
          reg_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone?: string | null
          organization?: string | null
          qr_code?: string
          qr_revoked_at?: string | null
          qr_version?: number
          reg_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string | null
          organization?: string | null
          qr_code?: string
          qr_revoked_at?: string | null
          qr_version?: number
          reg_id?: string | null
          updated_at?: string
        }
      }
      event_days: {
        Row: {
          id: string
          label: string
          event_date: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          label: string
          event_date: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          label?: string
          event_date?: string
          description?: string | null
        }
      }
      attendance: {
        Row: {
          id: string
          participant_id: string
          event_day_id: string
          status: AttendanceStatus
          scanned_at: string | null
          scanned_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          event_day_id: string
          status?: AttendanceStatus
          scanned_at?: string | null
          scanned_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          status?: AttendanceStatus
          scanned_at?: string | null
          scanned_by?: string | null
        }
      }
      scan_logs: {
        Row: {
          id: string
          participant_id: string
          event_day_id: string
          scanned_by: string
          raw_qr_data: string
          scan_result: 'success' | 'already_scanned' | 'invalid' | 'not_found'
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          event_day_id: string
          scanned_by: string
          raw_qr_data: string
          scan_result: 'success' | 'already_scanned' | 'invalid' | 'not_found'
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      attendance_status: AttendanceStatus
    }
  }
}
