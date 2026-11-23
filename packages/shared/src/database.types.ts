
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "amenities": {
                  Row: {
                    "active": boolean,"close_time": string,"created_at": string,"description": string | null,"fee_note": string | null,"id": string,"max_upcoming": number,"name": string,"open_time": string,"requires_approval": boolean,"slot_minutes": number,"society_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"close_time": string,"created_at"?: string,"description"?: string | null,"fee_note"?: string | null,"id"?: string,"max_upcoming"?: number,"name": string,"open_time": string,"requires_approval"?: boolean,"slot_minutes": number,"society_id": string
                  }
                  Update: {
                    "active"?: boolean,"close_time"?: string,"created_at"?: string,"description"?: string | null,"fee_note"?: string | null,"id"?: string,"max_upcoming"?: number,"name"?: string,"open_time"?: string,"requires_approval"?: boolean,"slot_minutes"?: number,"society_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "amenities_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"amenity_bookings": {
                  Row: {
                    "amenity_id": string,"booked_by_name": string | null,"created_at": string,"decided_at": string | null,"decided_by": string | null,"end_at": string,"flat_id": string,"id": string,"reject_reason": string | null,"society_id": string,"start_at": string,"status": Database["public"]['Enums']["booking_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amenity_id": string,"booked_by_name"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"end_at": string,"flat_id": string,"id"?: string,"reject_reason"?: string | null,"society_id": string,"start_at": string,"status": Database["public"]['Enums']["booking_status"]
                  }
                  Update: {
                    "amenity_id"?: string,"booked_by_name"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"end_at"?: string,"flat_id"?: string,"id"?: string,"reject_reason"?: string | null,"society_id"?: string,"start_at"?: string,"status"?: Database["public"]['Enums']["booking_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "amenity_bookings_amenity_id_fkey"
      columns: ["amenity_id"]
isOneToOne: false
      referencedRelation: "amenities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "amenity_bookings_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "amenity_bookings_flat_same_society"
      columns: ["flat_id","society_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "amenity_bookings_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"bills": {
                  Row: {
                    "amount": number,"created_at": string,"due_date": string,"flat_id": string,"id": string,"paid_at": string | null,"payment_mode": Database["public"]['Enums']["payment_mode"] | null,"payment_reference": string | null,"period": string,"receipt_no": string | null,"society_id": string,"status": Database["public"]['Enums']["bill_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"due_date": string,"flat_id": string,"id"?: string,"paid_at"?: string | null,"payment_mode"?: Database["public"]['Enums']["payment_mode"] | null,"payment_reference"?: string | null,"period": string,"receipt_no"?: string | null,"society_id": string,"status"?: Database["public"]['Enums']["bill_status"]
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"due_date"?: string,"flat_id"?: string,"id"?: string,"paid_at"?: string | null,"payment_mode"?: Database["public"]['Enums']["payment_mode"] | null,"payment_reference"?: string | null,"period"?: string,"receipt_no"?: string | null,"society_id"?: string,"status"?: Database["public"]['Enums']["bill_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "bills_flat_same_society"
      columns: ["flat_id","society_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "bills_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"complaint_comments": {
                  Row: {
                    "author_id": string | null,"author_name": string | null,"body": string,"complaint_id": string,"created_at": string,"id": string,"society_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"author_name"?: string | null,"body": string,"complaint_id": string,"created_at"?: string,"id"?: string,"society_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"author_name"?: string | null,"body"?: string,"complaint_id"?: string,"created_at"?: string,"id"?: string,"society_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "complaint_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaint_comments_complaint_same_society"
      columns: ["complaint_id","society_id"]
isOneToOne: false
      referencedRelation: "complaints"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "complaint_comments_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"complaints": {
                  Row: {
                    "category": Database["public"]['Enums']["complaint_category"],"created_at": string,"created_by": string | null,"created_by_name": string | null,"description": string,"flat_id": string,"id": string,"photo_path": string | null,"society_id": string,"status": Database["public"]['Enums']["complaint_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["complaint_category"],"created_at"?: string,"created_by"?: string | null,"created_by_name"?: string | null,"description": string,"flat_id": string,"id"?: string,"photo_path"?: string | null,"society_id": string,"status"?: Database["public"]['Enums']["complaint_status"],"updated_at"?: string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["complaint_category"],"created_at"?: string,"created_by"?: string | null,"created_by_name"?: string | null,"description"?: string,"flat_id"?: string,"id"?: string,"photo_path"?: string | null,"society_id"?: string,"status"?: Database["public"]['Enums']["complaint_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "complaints_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaints_flat_same_society"
      columns: ["flat_id","society_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "complaints_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "category": Database["public"]['Enums']["doc_category"],"created_at": string,"created_by": string | null,"file_kind": string,"file_path": string,"id": string,"society_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: Database["public"]['Enums']["doc_category"],"created_at"?: string,"created_by"?: string | null,"file_kind": string,"file_path": string,"id"?: string,"society_id": string,"title": string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["doc_category"],"created_at"?: string,"created_by"?: string | null,"file_kind"?: string,"file_path"?: string,"id"?: string,"society_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"emergency_contacts": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"note": string | null,"phone": string,"society_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"note"?: string | null,"phone": string,"society_id": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"note"?: string | null,"phone"?: string,"society_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "emergency_contacts_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"event_rsvps": {
                  Row: {
                    "by_name": string | null,"event_id": string,"flat_id": string,"heads": number,"response": Database["public"]['Enums']["rsvp_response"],"society_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "by_name"?: string | null,"event_id": string,"flat_id": string,"heads": number,"response": Database["public"]['Enums']["rsvp_response"],"society_id": string,"updated_at"?: string
                  }
                  Update: {
                    "by_name"?: string | null,"event_id"?: string,"flat_id"?: string,"heads"?: number,"response"?: Database["public"]['Enums']["rsvp_response"],"society_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_rsvps_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_rsvps_flat_same_society"
      columns: ["flat_id","society_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "event_rsvps_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "cancelled_at": string | null,"created_at": string,"created_by": string | null,"description": string | null,"ends_at": string | null,"id": string,"place": string | null,"society_id": string,"starts_at": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"ends_at"?: string | null,"id"?: string,"place"?: string | null,"society_id": string,"starts_at": string,"title": string
                  }
                  Update: {
                    "cancelled_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"ends_at"?: string | null,"id"?: string,"place"?: string | null,"society_id"?: string,"starts_at"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"expected_entries": {
                  Row: {
                    "cancelled_at": string | null,"company": string | null,"created_at": string,"created_by": string | null,"created_by_name": string | null,"flat_id": string,"id": string,"purpose": Database["public"]['Enums']["visit_purpose"],"society_id": string,"used_count": number,"valid_from": string,"valid_to": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_at"?: string | null,"company"?: string | null,"created_at"?: string,"created_by"?: string | null,"created_by_name"?: string | null,"flat_id": string,"id"?: string,"purpose": Database["public"]['Enums']["visit_purpose"],"society_id": string,"used_count"?: number,"valid_from"?: string,"valid_to": string
                  }
                  Update: {
                    "cancelled_at"?: string | null,"company"?: string | null,"created_at"?: string,"created_by"?: string | null,"created_by_name"?: string | null,"flat_id"?: string,"id"?: string,"purpose"?: Database["public"]['Enums']["visit_purpose"],"society_id"?: string,"used_count"?: number,"valid_from"?: string,"valid_to"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expected_entries_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expected_entries_flat_same_society"
      columns: ["flat_id","society_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "expected_entries_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"family_members": {
                  Row: {
                    "created_at": string,"flat_id": string,"id": string,"in_directory": boolean,"name": string,"phone": string | null,"relation": string | null,"show_phone": boolean,"society_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"flat_id": string,"id"?: string,"in_directory"?: boolean,"name": string,"phone"?: string | null,"relation"?: string | null,"show_phone"?: boolean,"society_id": string
                  }
                  Update: {
                    "created_at"?: string,"flat_id"?: string,"id"?: string,"in_directory"?: boolean,"name"?: string,"phone"?: string | null,"relation"?: string | null,"show_phone"?: boolean,"society_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_members_flat_same_society"
      columns: ["flat_id","society_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "family_members_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"flat_residents": {
                  Row: {
                    "added_by": string | null,"created_at": string,"flat_id": string,"id": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"created_at"?: string,"flat_id": string,"id"?: string,"profile_id": string
                  }
                  Update: {
                    "added_by"?: string | null,"created_at"?: string,"flat_id"?: string,"id"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "flat_residents_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flat_residents_flat_id_fkey"
      columns: ["flat_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flat_residents_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"flats": {
                  Row: {
                    "created_at": string,"id": string,"number": string,"society_id": string,"tower_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"number": string,"society_id": string,"tower_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"number"?: string,"society_id"?: string,"tower_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "flats_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flats_tower_id_fkey"
      columns: ["tower_id"]
isOneToOne: false
      referencedRelation: "towers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flats_tower_same_society"
      columns: ["tower_id","society_id"]
isOneToOne: false
      referencedRelation: "towers"
      referencedColumns: ["id","society_id"]
    }
                  ]
                },"helper_attendance": {
                  Row: {
                    "entry_at": string,"entry_by": string | null,"exit_at": string | null,"exit_by": string | null,"helper_id": string,"id": string,"society_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "entry_at"?: string,"entry_by"?: string | null,"exit_at"?: string | null,"exit_by"?: string | null,"helper_id": string,"id"?: string,"society_id": string
                  }
                  Update: {
                    "entry_at"?: string,"entry_by"?: string | null,"exit_at"?: string | null,"exit_by"?: string | null,"helper_id"?: string,"id"?: string,"society_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "helper_attendance_entry_by_fkey"
      columns: ["entry_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "helper_attendance_exit_by_fkey"
      columns: ["exit_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "helper_attendance_helper_same_society"
      columns: ["helper_id","society_id"]
isOneToOne: false
      referencedRelation: "helpers"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "helper_attendance_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"helper_flats": {
                  Row: {
                    "added_at": string,"added_by_name": string | null,"flat_id": string,"helper_id": string,"society_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"added_by_name"?: string | null,"flat_id": string,"helper_id": string,"society_id": string
                  }
                  Update: {
                    "added_at"?: string,"added_by_name"?: string | null,"flat_id"?: string,"helper_id"?: string,"society_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "helper_flats_flat_same_society"
      columns: ["flat_id","society_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "helper_flats_helper_same_society"
      columns: ["helper_id","society_id"]
isOneToOne: false
      referencedRelation: "helpers"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "helper_flats_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"helpers": {
                  Row: {
                    "active": boolean,"created_at": string,"entry_code": string,"id": string,"name": string,"phone": string,"photo_path": string | null,"society_id": string,"type": Database["public"]['Enums']["helper_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"entry_code": string,"id"?: string,"name": string,"phone": string,"photo_path"?: string | null,"society_id": string,"type": Database["public"]['Enums']["helper_type"]
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"entry_code"?: string,"id"?: string,"name"?: string,"phone"?: string,"photo_path"?: string | null,"society_id"?: string,"type"?: Database["public"]['Enums']["helper_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "helpers_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "claimed_at": string | null,"created_at": string,"created_by": string | null,"flat_id": string | null,"id": string,"name": string,"phone": string,"role": Database["public"]['Enums']["member_role"],"society_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"flat_id"?: string | null,"id"?: string,"name": string,"phone": string,"role": Database["public"]['Enums']["member_role"],"society_id": string
                  }
                  Update: {
                    "claimed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"flat_id"?: string | null,"id"?: string,"name"?: string,"phone"?: string,"role"?: Database["public"]['Enums']["member_role"],"society_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_flat_id_fkey"
      columns: ["flat_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_flat_same_society"
      columns: ["flat_id","society_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "invites_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"id": string,"profile_id": string,"role": Database["public"]['Enums']["member_role"],"society_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"profile_id": string,"role": Database["public"]['Enums']["member_role"],"society_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"profile_id"?: string,"role"?: Database["public"]['Enums']["member_role"],"society_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"notices": {
                  Row: {
                    "attachment_kind": string | null,"attachment_path": string | null,"body": string,"created_at": string,"created_by": string | null,"id": string,"pinned": boolean,"society_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_kind"?: string | null,"attachment_path"?: string | null,"body": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"pinned"?: boolean,"society_id": string,"title": string
                  }
                  Update: {
                    "attachment_kind"?: string | null,"attachment_path"?: string | null,"body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"pinned"?: boolean,"society_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notices_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"parcels": {
                  Row: {
                    "collected_at": string | null,"collected_by_name": string | null,"courier": string,"created_at": string,"flat_id": string,"handed_by": string | null,"id": string,"logged_by": string | null,"note": string | null,"photo_path": string | null,"society_id": string,"status": Database["public"]['Enums']["parcel_status"],"visit_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "collected_at"?: string | null,"collected_by_name"?: string | null,"courier": string,"created_at"?: string,"flat_id": string,"handed_by"?: string | null,"id"?: string,"logged_by"?: string | null,"note"?: string | null,"photo_path"?: string | null,"society_id": string,"status"?: Database["public"]['Enums']["parcel_status"],"visit_id"?: string | null
                  }
                  Update: {
                    "collected_at"?: string | null,"collected_by_name"?: string | null,"courier"?: string,"created_at"?: string,"flat_id"?: string,"handed_by"?: string | null,"id"?: string,"logged_by"?: string | null,"note"?: string | null,"photo_path"?: string | null,"society_id"?: string,"status"?: Database["public"]['Enums']["parcel_status"],"visit_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "parcels_flat_same_society"
      columns: ["flat_id","society_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "parcels_handed_by_fkey"
      columns: ["handed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "parcels_logged_by_fkey"
      columns: ["logged_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "parcels_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "parcels_visit_id_fkey"
      columns: ["visit_id"]
isOneToOne: false
      referencedRelation: "visits"
      referencedColumns: ["id"]
    }
                  ]
                },"passes": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string,"created_by_name": string | null,"flat_id": string,"guest_name": string,"id": string,"revoked_at": string | null,"society_id": string,"valid_from": string,"valid_to": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by": string,"created_by_name"?: string | null,"flat_id": string,"guest_name": string,"id"?: string,"revoked_at"?: string | null,"society_id": string,"valid_from": string,"valid_to": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string,"created_by_name"?: string | null,"flat_id"?: string,"guest_name"?: string,"id"?: string,"revoked_at"?: string | null,"society_id"?: string,"valid_from"?: string,"valid_to"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "passes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "passes_flat_id_fkey"
      columns: ["flat_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "passes_flat_same_society"
      columns: ["flat_id","society_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "passes_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"poll_votes": {
                  Row: {
                    "flat_id": string,"option_ids": (string)[],"poll_id": string,"society_id": string,"voted_at": string,"voted_by_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "flat_id": string,"option_ids": (string)[],"poll_id": string,"society_id": string,"voted_at"?: string,"voted_by_name"?: string | null
                  }
                  Update: {
                    "flat_id"?: string,"option_ids"?: (string)[],"poll_id"?: string,"society_id"?: string,"voted_at"?: string,"voted_by_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_votes_flat_same_society"
      columns: ["flat_id","society_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "poll_votes_poll_id_fkey"
      columns: ["poll_id"]
isOneToOne: false
      referencedRelation: "polls"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "poll_votes_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"polls": {
                  Row: {
                    "closed_at": string | null,"closes_at": string,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"last_reminded_at": string | null,"max_choices": number,"multi": boolean,"options": NonNullable<Json>,"question": string,"society_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"closes_at": string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"last_reminded_at"?: string | null,"max_choices"?: number,"multi"?: boolean,"options": NonNullable<Json>,"question": string,"society_id": string
                  }
                  Update: {
                    "closed_at"?: string | null,"closes_at"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"last_reminded_at"?: string | null,"max_choices"?: number,"multi"?: boolean,"options"?: NonNullable<Json>,"question"?: string,"society_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "polls_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "polls_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"name": string,"phone"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"phone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"push_tokens": {
                  Row: {
                    "created_at": string,"id": string,"platform": string,"profile_id": string,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"platform": string,"profile_id": string,"token": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"platform"?: string,"profile_id"?: string,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"receipt_counters": {
                  Row: {
                    "last": number,"month": string,"society_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last"?: number,"month": string,"society_id": string
                  }
                  Update: {
                    "last"?: number,"month"?: string,"society_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "receipt_counters_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"societies": {
                  Row: {
                    "address": string | null,"created_at": string,"id": string,"name": string,"short_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"id"?: string,"name": string,"short_code"?: string
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"short_code"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sos_alerts": {
                  Row: {
                    "acknowledged_at": string | null,"acknowledged_by_name": string | null,"created_at": string,"flat_id": string,"id": string,"raised_by_name": string | null,"resolved_at": string | null,"resolved_by_name": string | null,"resolved_note": string | null,"society_id": string,"status": Database["public"]['Enums']["sos_status"],"type": Database["public"]['Enums']["sos_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_at"?: string | null,"acknowledged_by_name"?: string | null,"created_at"?: string,"flat_id": string,"id"?: string,"raised_by_name"?: string | null,"resolved_at"?: string | null,"resolved_by_name"?: string | null,"resolved_note"?: string | null,"society_id": string,"status"?: Database["public"]['Enums']["sos_status"],"type": Database["public"]['Enums']["sos_type"]
                  }
                  Update: {
                    "acknowledged_at"?: string | null,"acknowledged_by_name"?: string | null,"created_at"?: string,"flat_id"?: string,"id"?: string,"raised_by_name"?: string | null,"resolved_at"?: string | null,"resolved_by_name"?: string | null,"resolved_note"?: string | null,"society_id"?: string,"status"?: Database["public"]['Enums']["sos_status"],"type"?: Database["public"]['Enums']["sos_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "sos_alerts_flat_same_society"
      columns: ["flat_id","society_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "sos_alerts_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"towers": {
                  Row: {
                    "building": string,"created_at": string,"id": string,"name": string,"society_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "building"?: string,"created_at"?: string,"id"?: string,"name": string,"society_id": string
                  }
                  Update: {
                    "building"?: string,"created_at"?: string,"id"?: string,"name"?: string,"society_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "towers_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                },"visits": {
                  Row: {
                    "created_at": string,"created_by": string,"entry_at": string | null,"exit_at": string | null,"expected_entry_id": string | null,"flat_id": string,"id": string,"manual_outcome": Database["public"]['Enums']["manual_outcome"] | null,"name": string,"pass_id": string | null,"phone": string | null,"photo_path": string | null,"purpose": Database["public"]['Enums']["visit_purpose"],"responded_at": string | null,"responded_by": string | null,"responded_by_name": string | null,"society_id": string,"status": Database["public"]['Enums']["visit_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"entry_at"?: string | null,"exit_at"?: string | null,"expected_entry_id"?: string | null,"flat_id": string,"id"?: string,"manual_outcome"?: Database["public"]['Enums']["manual_outcome"] | null,"name": string,"pass_id"?: string | null,"phone"?: string | null,"photo_path"?: string | null,"purpose": Database["public"]['Enums']["visit_purpose"],"responded_at"?: string | null,"responded_by"?: string | null,"responded_by_name"?: string | null,"society_id": string,"status"?: Database["public"]['Enums']["visit_status"]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"entry_at"?: string | null,"exit_at"?: string | null,"expected_entry_id"?: string | null,"flat_id"?: string,"id"?: string,"manual_outcome"?: Database["public"]['Enums']["manual_outcome"] | null,"name"?: string,"pass_id"?: string | null,"phone"?: string | null,"photo_path"?: string | null,"purpose"?: Database["public"]['Enums']["visit_purpose"],"responded_at"?: string | null,"responded_by"?: string | null,"responded_by_name"?: string | null,"society_id"?: string,"status"?: Database["public"]['Enums']["visit_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "visits_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_expected_entry_id_fkey"
      columns: ["expected_entry_id"]
isOneToOne: false
      referencedRelation: "expected_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_flat_id_fkey"
      columns: ["flat_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_flat_same_society"
      columns: ["flat_id","society_id"]
isOneToOne: false
      referencedRelation: "flats"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "visits_pass_id_fkey"
      columns: ["pass_id"]
isOneToOne: false
      referencedRelation: "passes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_pass_same_society"
      columns: ["pass_id","society_id"]
isOneToOne: false
      referencedRelation: "passes"
      referencedColumns: ["id","society_id"]
    },{
      foreignKeyName: "visits_responded_by_fkey"
      columns: ["responded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_society_id_fkey"
      columns: ["society_id"]
isOneToOne: false
      referencedRelation: "societies"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "ack_sos":
{ Args: { "p_actor_name"?: string,"p_id": string }; Returns: {
              "acknowledged_at": string | null,
"acknowledged_by_name": string | null,
"created_at": string,
"flat_id": string,
"id": string,
"raised_by_name": string | null,
"resolved_at": string | null,
"resolved_by_name": string | null,
"resolved_note": string | null,
"society_id": string,
"status": Database["public"]['Enums']["sos_status"],
"type": Database["public"]['Enums']["sos_type"]
            }
                          SetofOptions: {
        from: "*"
        to: "sos_alerts"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_complaint_comment":
{ Args: { "p_actor_name"?: string,"p_body": string,"p_complaint_id": string }; Returns: {
              "author_id": string | null,
"author_name": string | null,
"body": string,
"complaint_id": string,
"created_at": string,
"id": string,
"society_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "complaint_comments"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_document":
{ Args: { "p_category": Database["public"]['Enums']["doc_category"],"p_file_kind": string,"p_file_path": string,"p_title": string }; Returns: {
              "category": Database["public"]['Enums']["doc_category"],
"created_at": string,
"created_by": string | null,
"file_kind": string,
"file_path": string,
"id": string,
"society_id": string,
"title": string
            }
                          SetofOptions: {
        from: "*"
        to: "documents"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_helper":
{ Args: { "p_actor_name"?: string,"p_flat_id": string,"p_name": string,"p_phone": string,"p_photo_path"?: string,"p_type": Database["public"]['Enums']["helper_type"] }; Returns: {
              "active": boolean,
"created_at": string,
"entry_code": string,
"id": string,
"name": string,
"phone": string,
"photo_path": string | null,
"society_id": string,
"type": Database["public"]['Enums']["helper_type"]
            }
                          SetofOptions: {
        from: "*"
        to: "helpers"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_household_member":
{ Args: { "p_flat_id": string,"p_name": string,"p_phone": string }; Returns: {
              "claimed_at": string | null,
"created_at": string,
"created_by": string | null,
"flat_id": string | null,
"id": string,
"name": string,
"phone": string,
"role": Database["public"]['Enums']["member_role"],
"society_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "invites"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_society":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"amenity_slots":
{ Args: { "p_amenity_id": string,"p_date": string,"p_flat_id"?: string }; Returns: {
              "end_at": string,"start_at": string,"state": string
            }[]
                           },
"book_amenity":
{ Args: { "p_actor_name"?: string,"p_amenity_id": string,"p_flat_id": string,"p_start_at": string }; Returns: {
              "amenity_id": string,
"booked_by_name": string | null,
"created_at": string,
"decided_at": string | null,
"decided_by": string | null,
"end_at": string,
"flat_id": string,
"id": string,
"reject_reason": string | null,
"society_id": string,
"start_at": string,
"status": Database["public"]['Enums']["booking_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "amenity_bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"can_view_profile":
{ Args: { "p_profile": string }; Returns: boolean
                           },
"cancel_booking":
{ Args: { "p_booking_id": string }; Returns: {
              "amenity_id": string,
"booked_by_name": string | null,
"created_at": string,
"decided_at": string | null,
"decided_by": string | null,
"end_at": string,
"flat_id": string,
"id": string,
"reject_reason": string | null,
"society_id": string,
"start_at": string,
"status": Database["public"]['Enums']["booking_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "amenity_bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_event":
{ Args: { "p_id": string }; Returns: {
              "cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"description": string | null,
"ends_at": string | null,
"id": string,
"place": string | null,
"society_id": string,
"starts_at": string,
"title": string
            }
                          SetofOptions: {
        from: "*"
        to: "events"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_expected_entry":
{ Args: { "p_id": string }; Returns: {
              "cancelled_at": string | null,
"company": string | null,
"created_at": string,
"created_by": string | null,
"created_by_name": string | null,
"flat_id": string,
"id": string,
"purpose": Database["public"]['Enums']["visit_purpose"],
"society_id": string,
"used_count": number,
"valid_from": string,
"valid_to": string
            }
                          SetofOptions: {
        from: "*"
        to: "expected_entries"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_sos":
{ Args: { "p_id": string }; Returns: {
              "acknowledged_at": string | null,
"acknowledged_by_name": string | null,
"created_at": string,
"flat_id": string,
"id": string,
"raised_by_name": string | null,
"resolved_at": string | null,
"resolved_by_name": string | null,
"resolved_note": string | null,
"society_id": string,
"status": Database["public"]['Enums']["sos_status"],
"type": Database["public"]['Enums']["sos_type"]
            }
                          SetofOptions: {
        from: "*"
        to: "sos_alerts"
        isOneToOne: true
        isSetofReturn: false
      } },
"claim_invites":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"clean_actor_name":
{ Args: { "p_name": string }; Returns: string
                           },
"close_poll":
{ Args: { "p_poll_id": string }; Returns: {
              "closed_at": string | null,
"closes_at": string,
"created_at": string,
"created_by": string | null,
"description": string | null,
"id": string,
"last_reminded_at": string | null,
"max_choices": number,
"multi": boolean,
"options": NonNullable<Json>,
"question": string,
"society_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "polls"
        isOneToOne: true
        isSetofReturn: false
      } },
"collect_parcel":
{ Args: { "p_collected_by_name": string,"p_parcel_id": string }; Returns: {
              "collected_at": string | null,
"collected_by_name": string | null,
"courier": string,
"created_at": string,
"flat_id": string,
"handed_by": string | null,
"id": string,
"logged_by": string | null,
"note": string | null,
"photo_path": string | null,
"society_id": string,
"status": Database["public"]['Enums']["parcel_status"],
"visit_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "parcels"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_complaint":
{ Args: { "p_actor_name"?: string,"p_category": Database["public"]['Enums']["complaint_category"],"p_description": string,"p_flat_id": string,"p_photo_path"?: string }; Returns: {
              "category": Database["public"]['Enums']["complaint_category"],
"created_at": string,
"created_by": string | null,
"created_by_name": string | null,
"description": string,
"flat_id": string,
"id": string,
"photo_path": string | null,
"society_id": string,
"status": Database["public"]['Enums']["complaint_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "complaints"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_event":
{ Args: { "p_description": string,"p_ends_at": string,"p_place": string,"p_starts_at": string,"p_title": string }; Returns: {
              "cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"description": string | null,
"ends_at": string | null,
"id": string,
"place": string | null,
"society_id": string,
"starts_at": string,
"title": string
            }
                          SetofOptions: {
        from: "*"
        to: "events"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_expected_entry":
{ Args: { "p_actor_name"?: string,"p_company": string,"p_flat_id": string,"p_hours": number,"p_purpose": Database["public"]['Enums']["visit_purpose"] }; Returns: {
              "cancelled_at": string | null,
"company": string | null,
"created_at": string,
"created_by": string | null,
"created_by_name": string | null,
"flat_id": string,
"id": string,
"purpose": Database["public"]['Enums']["visit_purpose"],
"society_id": string,
"used_count": number,
"valid_from": string,
"valid_to": string
            }
                          SetofOptions: {
        from: "*"
        to: "expected_entries"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_notice":
{ Args: { "p_attachment_kind"?: string,"p_attachment_path"?: string,"p_body": string,"p_pinned"?: boolean,"p_title": string }; Returns: {
              "attachment_kind": string | null,
"attachment_path": string | null,
"body": string,
"created_at": string,
"created_by": string | null,
"id": string,
"pinned": boolean,
"society_id": string,
"title": string
            }
                          SetofOptions: {
        from: "*"
        to: "notices"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_pass":
{ Args: { "p_actor_name"?: string,"p_flat_id": string,"p_guest_name": string,"p_valid_from": string,"p_valid_to": string }; Returns: {
              "code": string,
"created_at": string,
"created_by": string,
"created_by_name": string | null,
"flat_id": string,
"guest_name": string,
"id": string,
"revoked_at": string | null,
"society_id": string,
"valid_from": string,
"valid_to": string
            }
                          SetofOptions: {
        from: "*"
        to: "passes"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_poll":
{ Args: { "p_closes_at": string,"p_description": string,"p_max_choices": number,"p_multi": boolean,"p_options": (string)[],"p_question": string }; Returns: {
              "closed_at": string | null,
"closes_at": string,
"created_at": string,
"created_by": string | null,
"description": string | null,
"id": string,
"last_reminded_at": string | null,
"max_choices": number,
"multi": boolean,
"options": NonNullable<Json>,
"question": string,
"society_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "polls"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_visit":
{ Args: { "p_flat_id": string,"p_name": string,"p_phone": string,"p_photo_path": string,"p_purpose": Database["public"]['Enums']["visit_purpose"] }; Returns: {
              "created_at": string,
"created_by": string,
"entry_at": string | null,
"exit_at": string | null,
"expected_entry_id": string | null,
"flat_id": string,
"id": string,
"manual_outcome": Database["public"]['Enums']["manual_outcome"] | null,
"name": string,
"pass_id": string | null,
"phone": string | null,
"photo_path": string | null,
"purpose": Database["public"]['Enums']["visit_purpose"],
"responded_at": string | null,
"responded_by": string | null,
"responded_by_name": string | null,
"society_id": string,
"status": Database["public"]['Enums']["visit_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "visits"
        isOneToOne: true
        isSetofReturn: false
      } },
"decide_booking":
{ Args: { "p_approve": boolean,"p_booking_id": string,"p_reason"?: string }; Returns: {
              "amenity_id": string,
"booked_by_name": string | null,
"created_at": string,
"decided_at": string | null,
"decided_by": string | null,
"end_at": string,
"flat_id": string,
"id": string,
"reject_reason": string | null,
"society_id": string,
"start_at": string,
"status": Database["public"]['Enums']["booking_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "amenity_bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"delete_document":
{ Args: { "p_id": string }; Returns: string
                           },
"delete_emergency_contact":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_notice":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_poll":
{ Args: { "p_poll_id": string }; Returns: undefined
                           },
"directory_committee":
{ Args: Record<PropertyKey, never>; Returns: {
              "name": string
            }[]
                           },
"event_summary":
{ Args: { "p_event_id": string }; Returns: Json
                           },
"expire_stale_visits":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"flat_contacts":
{ Args: { "p_flat_id": string }; Returns: {
              "name": string,"phone": string,"relation": string
            }[]
                           },
"generate_bills":
{ Args: { "p_amount": number,"p_due_date": string,"p_period": string }; Returns: number
                           },
"generate_bills_custom":
{ Args: { "p_due_date": string,"p_period": string,"p_rows": Json }; Returns: number
                           },
"has_role":
{ Args: { "p_role": Database["public"]['Enums']["member_role"],"p_society": string }; Returns: boolean
                           },
"has_role_for_flat":
{ Args: { "p_flat": string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: boolean
                           },
"helper_check_in":
{ Args: { "p_helper_id": string }; Returns: {
              "entry_at": string,
"entry_by": string | null,
"exit_at": string | null,
"exit_by": string | null,
"helper_id": string,
"id": string,
"society_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "helper_attendance"
        isOneToOne: true
        isSetofReturn: false
      } },
"helper_check_out":
{ Args: { "p_helper_id": string }; Returns: {
              "entry_at": string,
"entry_by": string | null,
"exit_at": string | null,
"exit_by": string | null,
"helper_id": string,
"id": string,
"society_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "helper_attendance"
        isOneToOne: true
        isSetofReturn: false
      } },
"is_flat_resident":
{ Args: { "p_flat": string }; Returns: boolean
                           },
"is_member":
{ Args: { "p_society": string }; Returns: boolean
                           },
"log_parcel":
{ Args: { "p_courier": string,"p_flat_id": string,"p_note": string,"p_photo_path": string,"p_visit_id"?: string }; Returns: {
              "collected_at": string | null,
"collected_by_name": string | null,
"courier": string,
"created_at": string,
"flat_id": string,
"handed_by": string | null,
"id": string,
"logged_by": string | null,
"note": string | null,
"photo_path": string | null,
"society_id": string,
"status": Database["public"]['Enums']["parcel_status"],
"visit_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "parcels"
        isOneToOne: true
        isSetofReturn: false
      } },
"login_directory":
{ Args: { "p_society_id": string }; Returns: {
              "building": string,"flat_id": string,"flat_number": string,"society_name": string,"wing": string
            }[]
                           },
"mark_bill_paid":
{ Args: { "p_bill_id": string,"p_mode": Database["public"]['Enums']["payment_mode"],"p_reference"?: string }; Returns: {
              "amount": number,
"created_at": string,
"due_date": string,
"flat_id": string,
"id": string,
"paid_at": string | null,
"payment_mode": Database["public"]['Enums']["payment_mode"] | null,
"payment_reference": string | null,
"period": string,
"receipt_no": string | null,
"society_id": string,
"status": Database["public"]['Enums']["bill_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "bills"
        isOneToOne: true
        isSetofReturn: false
      } },
"mark_entry":
{ Args: { "p_visit_id": string }; Returns: {
              "created_at": string,
"created_by": string,
"entry_at": string | null,
"exit_at": string | null,
"expected_entry_id": string | null,
"flat_id": string,
"id": string,
"manual_outcome": Database["public"]['Enums']["manual_outcome"] | null,
"name": string,
"pass_id": string | null,
"phone": string | null,
"photo_path": string | null,
"purpose": Database["public"]['Enums']["visit_purpose"],
"responded_at": string | null,
"responded_by": string | null,
"responded_by_name": string | null,
"society_id": string,
"status": Database["public"]['Enums']["visit_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "visits"
        isOneToOne: true
        isSetofReturn: false
      } },
"mark_exit":
{ Args: { "p_visit_id": string }; Returns: {
              "created_at": string,
"created_by": string,
"entry_at": string | null,
"exit_at": string | null,
"expected_entry_id": string | null,
"flat_id": string,
"id": string,
"manual_outcome": Database["public"]['Enums']["manual_outcome"] | null,
"name": string,
"pass_id": string | null,
"phone": string | null,
"photo_path": string | null,
"purpose": Database["public"]['Enums']["visit_purpose"],
"responded_at": string | null,
"responded_by": string | null,
"responded_by_name": string | null,
"society_id": string,
"status": Database["public"]['Enums']["visit_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "visits"
        isOneToOne: true
        isSetofReturn: false
      } },
"notify_post":
{ Args: { "p_old": Json,"p_record": Json,"p_table": string,"p_type": string }; Returns: undefined
                           },
"poll_results":
{ Args: { "p_flat_id"?: string,"p_poll_id": string }; Returns: Json
                           },
"raise_sos":
{ Args: { "p_actor_name"?: string,"p_flat_id": string,"p_type": Database["public"]['Enums']["sos_type"] }; Returns: {
              "acknowledged_at": string | null,
"acknowledged_by_name": string | null,
"created_at": string,
"flat_id": string,
"id": string,
"raised_by_name": string | null,
"resolved_at": string | null,
"resolved_by_name": string | null,
"resolved_note": string | null,
"society_id": string,
"status": Database["public"]['Enums']["sos_status"],
"type": Database["public"]['Enums']["sos_type"]
            }
                          SetofOptions: {
        from: "*"
        to: "sos_alerts"
        isOneToOne: true
        isSetofReturn: false
      } },
"record_manual_outcome":
{ Args: { "p_outcome": Database["public"]['Enums']["manual_outcome"],"p_visit_id": string }; Returns: {
              "created_at": string,
"created_by": string,
"entry_at": string | null,
"exit_at": string | null,
"expected_entry_id": string | null,
"flat_id": string,
"id": string,
"manual_outcome": Database["public"]['Enums']["manual_outcome"] | null,
"name": string,
"pass_id": string | null,
"phone": string | null,
"photo_path": string | null,
"purpose": Database["public"]['Enums']["visit_purpose"],
"responded_at": string | null,
"responded_by": string | null,
"responded_by_name": string | null,
"society_id": string,
"status": Database["public"]['Enums']["visit_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "visits"
        isOneToOne: true
        isSetofReturn: false
      } },
"register_push_token":
{ Args: { "p_platform": string,"p_token": string }; Returns: undefined
                           },
"remind_poll":
{ Args: { "p_poll_id": string }; Returns: {
              "closed_at": string | null,
"closes_at": string,
"created_at": string,
"created_by": string | null,
"description": string | null,
"id": string,
"last_reminded_at": string | null,
"max_choices": number,
"multi": boolean,
"options": NonNullable<Json>,
"question": string,
"society_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "polls"
        isOneToOne: true
        isSetofReturn: false
      } },
"remove_helper_from_flat":
{ Args: { "p_flat_id": string,"p_helper_id": string }; Returns: undefined
                           },
"resident_directory":
{ Args: Record<PropertyKey, never>; Returns: {
              "flat_id": string,"flat_label": string,"name": string,"phone": string,"relation": string
            }[]
                           },
"resolve_sos":
{ Args: { "p_actor_name"?: string,"p_id": string,"p_note"?: string }; Returns: {
              "acknowledged_at": string | null,
"acknowledged_by_name": string | null,
"created_at": string,
"flat_id": string,
"id": string,
"raised_by_name": string | null,
"resolved_at": string | null,
"resolved_by_name": string | null,
"resolved_note": string | null,
"society_id": string,
"status": Database["public"]['Enums']["sos_status"],
"type": Database["public"]['Enums']["sos_type"]
            }
                          SetofOptions: {
        from: "*"
        to: "sos_alerts"
        isOneToOne: true
        isSetofReturn: false
      } },
"respond_to_visit":
{ Args: { "p_actor_name"?: string,"p_response": Database["public"]['Enums']["visit_status"],"p_visit_id": string }; Returns: {
              "created_at": string,
"created_by": string,
"entry_at": string | null,
"exit_at": string | null,
"expected_entry_id": string | null,
"flat_id": string,
"id": string,
"manual_outcome": Database["public"]['Enums']["manual_outcome"] | null,
"name": string,
"pass_id": string | null,
"phone": string | null,
"photo_path": string | null,
"purpose": Database["public"]['Enums']["visit_purpose"],
"responded_at": string | null,
"responded_by": string | null,
"responded_by_name": string | null,
"society_id": string,
"status": Database["public"]['Enums']["visit_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "visits"
        isOneToOne: true
        isSetofReturn: false
      } },
"return_parcel":
{ Args: { "p_parcel_id": string }; Returns: {
              "collected_at": string | null,
"collected_by_name": string | null,
"courier": string,
"created_at": string,
"flat_id": string,
"handed_by": string | null,
"id": string,
"logged_by": string | null,
"note": string | null,
"photo_path": string | null,
"society_id": string,
"status": Database["public"]['Enums']["parcel_status"],
"visit_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "parcels"
        isOneToOne: true
        isSetofReturn: false
      } },
"revoke_pass":
{ Args: { "p_pass_id": string }; Returns: {
              "code": string,
"created_at": string,
"created_by": string,
"created_by_name": string | null,
"flat_id": string,
"guest_name": string,
"id": string,
"revoked_at": string | null,
"society_id": string,
"valid_from": string,
"valid_to": string
            }
                          SetofOptions: {
        from: "*"
        to: "passes"
        isOneToOne: true
        isSetofReturn: false
      } },
"rsvp_event":
{ Args: { "p_actor_name"?: string,"p_event_id": string,"p_flat_id": string,"p_heads"?: number,"p_response": Database["public"]['Enums']["rsvp_response"] }; Returns: {
              "by_name": string | null,
"event_id": string,
"flat_id": string,
"heads": number,
"response": Database["public"]['Enums']["rsvp_response"],
"society_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "event_rsvps"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_complaint_status":
{ Args: { "p_complaint_id": string,"p_status": Database["public"]['Enums']["complaint_status"] }; Returns: {
              "category": Database["public"]['Enums']["complaint_category"],
"created_at": string,
"created_by": string | null,
"created_by_name": string | null,
"description": string,
"flat_id": string,
"id": string,
"photo_path": string | null,
"society_id": string,
"status": Database["public"]['Enums']["complaint_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "complaints"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_directory_visibility":
{ Args: { "p_in_directory": boolean,"p_member_id": string,"p_show_phone": boolean }; Returns: {
              "created_at": string,
"flat_id": string,
"id": string,
"in_directory": boolean,
"name": string,
"phone": string | null,
"relation": string | null,
"show_phone": boolean,
"society_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "family_members"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_helper_active":
{ Args: { "p_active": boolean,"p_helper_id": string }; Returns: {
              "active": boolean,
"created_at": string,
"entry_code": string,
"id": string,
"name": string,
"phone": string,
"photo_path": string | null,
"society_id": string,
"type": Database["public"]['Enums']["helper_type"]
            }
                          SetofOptions: {
        from: "*"
        to: "helpers"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_notice_pinned":
{ Args: { "p_id": string,"p_pinned": boolean }; Returns: {
              "attachment_kind": string | null,
"attachment_path": string | null,
"body": string,
"created_at": string,
"created_by": string | null,
"id": string,
"pinned": boolean,
"society_id": string,
"title": string
            }
                          SetofOptions: {
        from: "*"
        to: "notices"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_visit_photo":
{ Args: { "p_photo_path": string,"p_visit_id": string }; Returns: {
              "created_at": string,
"created_by": string,
"entry_at": string | null,
"exit_at": string | null,
"expected_entry_id": string | null,
"flat_id": string,
"id": string,
"manual_outcome": Database["public"]['Enums']["manual_outcome"] | null,
"name": string,
"pass_id": string | null,
"phone": string | null,
"photo_path": string | null,
"purpose": Database["public"]['Enums']["visit_purpose"],
"responded_at": string | null,
"responded_by": string | null,
"responded_by_name": string | null,
"society_id": string,
"status": Database["public"]['Enums']["visit_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "visits"
        isOneToOne: true
        isSetofReturn: false
      } },
"upsert_amenity":
{ Args: { "p_active": boolean,"p_close_time": string,"p_description": string,"p_fee_note": string,"p_id": string,"p_max_upcoming": number,"p_name": string,"p_open_time": string,"p_requires_approval": boolean,"p_slot_minutes": number }; Returns: {
              "active": boolean,
"close_time": string,
"created_at": string,
"description": string | null,
"fee_note": string | null,
"id": string,
"max_upcoming": number,
"name": string,
"open_time": string,
"requires_approval": boolean,
"slot_minutes": number,
"society_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "amenities"
        isOneToOne: true
        isSetofReturn: false
      } },
"upsert_emergency_contact":
{ Args: { "p_id": string,"p_name": string,"p_note": string,"p_phone": string,"p_sort_order": number }; Returns: {
              "created_at": string,
"id": string,
"name": string,
"note": string | null,
"phone": string,
"society_id": string,
"sort_order": number
            }
                          SetofOptions: {
        from: "*"
        to: "emergency_contacts"
        isOneToOne: true
        isSetofReturn: false
      } },
"use_pass":
{ Args: { "p_code": string }; Returns: {
              "created_at": string,
"created_by": string,
"entry_at": string | null,
"exit_at": string | null,
"expected_entry_id": string | null,
"flat_id": string,
"id": string,
"manual_outcome": Database["public"]['Enums']["manual_outcome"] | null,
"name": string,
"pass_id": string | null,
"phone": string | null,
"photo_path": string | null,
"purpose": Database["public"]['Enums']["visit_purpose"],
"responded_at": string | null,
"responded_by": string | null,
"responded_by_name": string | null,
"society_id": string,
"status": Database["public"]['Enums']["visit_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "visits"
        isOneToOne: true
        isSetofReturn: false
      } },
"visit_has_app_users":
{ Args: { "p_flat_id": string }; Returns: boolean
                           },
"vote_poll":
{ Args: { "p_actor_name"?: string,"p_flat_id": string,"p_option_ids": (string)[],"p_poll_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "bill_status": "unpaid"|"paid","booking_status": "pending"|"confirmed"|"rejected"|"cancelled","complaint_category": "plumbing"|"electrical"|"lift"|"cleaning"|"security"|"parking"|"other","complaint_status": "open"|"in_progress"|"resolved","doc_category": "bylaws"|"minutes"|"circular"|"form"|"other","helper_type": "maid"|"cook"|"driver"|"nanny"|"car_cleaner"|"tutor"|"other","manual_outcome": "allowed"|"sent_back","member_role": "admin"|"guard"|"resident","parcel_status": "at_gate"|"collected"|"returned","payment_mode": "cash"|"cheque"|"upi"|"other","rsvp_response": "going"|"maybe"|"no","sos_status": "open"|"acknowledged"|"resolved"|"cancelled","sos_type": "medical"|"fire"|"security"|"lift"|"other","visit_purpose": "delivery"|"guest"|"cab"|"service"|"other","visit_status": "pending"|"approved"|"denied"|"leave_at_gate"|"expired"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "bill_status": ["unpaid", "paid"],"booking_status": ["pending", "confirmed", "rejected", "cancelled"],"complaint_category": ["plumbing", "electrical", "lift", "cleaning", "security", "parking", "other"],"complaint_status": ["open", "in_progress", "resolved"],"doc_category": ["bylaws", "minutes", "circular", "form", "other"],"helper_type": ["maid", "cook", "driver", "nanny", "car_cleaner", "tutor", "other"],"manual_outcome": ["allowed", "sent_back"],"member_role": ["admin", "guard", "resident"],"parcel_status": ["at_gate", "collected", "returned"],"payment_mode": ["cash", "cheque", "upi", "other"],"rsvp_response": ["going", "maybe", "no"],"sos_status": ["open", "acknowledged", "resolved", "cancelled"],"sos_type": ["medical", "fire", "security", "lift", "other"],"visit_purpose": ["delivery", "guest", "cab", "service", "other"],"visit_status": ["pending", "approved", "denied", "leave_at_gate", "expired"]
          }
        }
} as const
