
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
            "bills": {
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
                },"family_members": {
                  Row: {
                    "created_at": string,"flat_id": string,"id": string,"name": string,"phone": string | null,"relation": string | null,"society_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"flat_id": string,"id"?: string,"name": string,"phone"?: string | null,"relation"?: string | null,"society_id": string
                  }
                  Update: {
                    "created_at"?: string,"flat_id"?: string,"id"?: string,"name"?: string,"phone"?: string | null,"relation"?: string | null,"society_id"?: string
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
                    "created_at": string,"created_by": string,"entry_at": string | null,"exit_at": string | null,"flat_id": string,"id": string,"manual_outcome": Database["public"]['Enums']["manual_outcome"] | null,"name": string,"pass_id": string | null,"phone": string | null,"photo_path": string | null,"purpose": Database["public"]['Enums']["visit_purpose"],"responded_at": string | null,"responded_by": string | null,"responded_by_name": string | null,"society_id": string,"status": Database["public"]['Enums']["visit_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"entry_at"?: string | null,"exit_at"?: string | null,"flat_id": string,"id"?: string,"manual_outcome"?: Database["public"]['Enums']["manual_outcome"] | null,"name": string,"pass_id"?: string | null,"phone"?: string | null,"photo_path"?: string | null,"purpose": Database["public"]['Enums']["visit_purpose"],"responded_at"?: string | null,"responded_by"?: string | null,"responded_by_name"?: string | null,"society_id": string,"status"?: Database["public"]['Enums']["visit_status"]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"entry_at"?: string | null,"exit_at"?: string | null,"flat_id"?: string,"id"?: string,"manual_outcome"?: Database["public"]['Enums']["manual_outcome"] | null,"name"?: string,"pass_id"?: string | null,"phone"?: string | null,"photo_path"?: string | null,"purpose"?: Database["public"]['Enums']["visit_purpose"],"responded_at"?: string | null,"responded_by"?: string | null,"responded_by_name"?: string | null,"society_id"?: string,"status"?: Database["public"]['Enums']["visit_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "visits_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
"can_view_profile":
{ Args: { "p_profile": string }; Returns: boolean
                           },
"claim_invites":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"clean_actor_name":
{ Args: { "p_name": string }; Returns: string
                           },
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
"create_visit":
{ Args: { "p_flat_id": string,"p_name": string,"p_phone": string,"p_photo_path": string,"p_purpose": Database["public"]['Enums']["visit_purpose"] }; Returns: {
              "created_at": string,
"created_by": string,
"entry_at": string | null,
"exit_at": string | null,
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
"delete_notice":
{ Args: { "p_id": string }; Returns: undefined
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
"is_flat_resident":
{ Args: { "p_flat": string }; Returns: boolean
                           },
"is_member":
{ Args: { "p_society": string }; Returns: boolean
                           },
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
"record_manual_outcome":
{ Args: { "p_outcome": Database["public"]['Enums']["manual_outcome"],"p_visit_id": string }; Returns: {
              "created_at": string,
"created_by": string,
"entry_at": string | null,
"exit_at": string | null,
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
"respond_to_visit":
{ Args: { "p_actor_name"?: string,"p_response": Database["public"]['Enums']["visit_status"],"p_visit_id": string }; Returns: {
              "created_at": string,
"created_by": string,
"entry_at": string | null,
"exit_at": string | null,
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
"use_pass":
{ Args: { "p_code": string }; Returns: {
              "created_at": string,
"created_by": string,
"entry_at": string | null,
"exit_at": string | null,
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
                           }
          }
          Enums: {
            "bill_status": "unpaid"|"paid","complaint_category": "plumbing"|"electrical"|"lift"|"cleaning"|"security"|"parking"|"other","complaint_status": "open"|"in_progress"|"resolved","manual_outcome": "allowed"|"sent_back","member_role": "admin"|"guard"|"resident","payment_mode": "cash"|"cheque"|"upi"|"other","visit_purpose": "delivery"|"guest"|"cab"|"service"|"other","visit_status": "pending"|"approved"|"denied"|"leave_at_gate"|"expired"
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
            "bill_status": ["unpaid", "paid"],"complaint_category": ["plumbing", "electrical", "lift", "cleaning", "security", "parking", "other"],"complaint_status": ["open", "in_progress", "resolved"],"manual_outcome": ["allowed", "sent_back"],"member_role": ["admin", "guard", "resident"],"payment_mode": ["cash", "cheque", "upi", "other"],"visit_purpose": ["delivery", "guest", "cab", "service", "other"],"visit_status": ["pending", "approved", "denied", "leave_at_gate", "expired"]
          }
        }
} as const
