export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_audit: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          note: string
          subject_id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          note: string
          subject_id: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          note?: string
          subject_id?: string
        }
        Relationships: []
      }
      cash_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      holdings: {
        Row: {
          avg_cost: number
          qty: number
          symbol: string
          user_id: string
        }
        Insert: {
          avg_cost?: number
          qty?: number
          symbol: string
          user_id: string
        }
        Update: {
          avg_cost?: number
          qty?: number
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      loans: {
        Row: {
          balance: number
          created_at: string
          id: string
          kind: string
          monthly_payment: number
          principal: number
          rate: number
          status: string
          term_months: number
          user_id: string
        }
        Insert: {
          balance: number
          created_at?: string
          id?: string
          kind: string
          monthly_payment: number
          principal: number
          rate: number
          status?: string
          term_months: number
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          kind?: string
          monthly_payment?: number
          principal?: number
          rate?: number
          status?: string
          term_months?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          cash: number
          created_at: string
          date_of_birth: string | null
          full_name: string | null
          id: string
          id_document_path: string | null
          id_type: string | null
          kyc_status: string
          kyc_submitted_at: string | null
          phone: string | null
          ssn_last4: string | null
        }
        Insert: {
          address?: string | null
          cash?: number
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          id: string
          id_document_path?: string | null
          id_type?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          phone?: string | null
          ssn_last4?: string | null
        }
        Update: {
          address?: string | null
          cash?: number
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          id?: string
          id_document_path?: string | null
          id_type?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          phone?: string | null
          ssn_last4?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          fee: number
          id: string
          method: string | null
          note: string | null
          price: number | null
          qty: number | null
          symbol: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fee?: number
          id?: string
          method?: string | null
          note?: string | null
          price?: number | null
          qty?: number | null
          symbol?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee?: number
          id?: string
          method?: string | null
          note?: string | null
          price?: number | null
          qty?: number | null
          symbol?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          created_at: string
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_decide_cash: {
        Args: { _approve: boolean; _id: string; _note: string }
        Returns: undefined
      }
      admin_decide_loan: {
        Args: { _approve: boolean; _id: string; _note: string }
        Returns: undefined
      }
      admin_review_identity: {
        Args: { _note: string; _status: string; _subject: string }
        Returns: undefined
      }
      cash_move: {
        Args: { _amount: number; _method: string; _type: string; _uid: string }
        Returns: undefined
      }
      execute_trade: {
        Args: {
          _price: number
          _qty: number
          _side: string
          _symbol: string
          _uid: string
        }
        Returns: undefined
      }
      execute_trade_v2: {
        Args: {
          _fee_rate: number
          _price: number
          _qty: number
          _side: string
          _symbol: string
          _uid: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      open_loan: {
        Args: {
          _kind: string
          _principal: number
          _rate: number
          _term: number
          _uid: string
        }
        Returns: undefined
      }
      repay_loan: {
        Args: { _amount: number; _loan: string; _uid: string }
        Returns: undefined
      }
      request_cash: {
        Args: { _amount: number; _method: string; _type: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "super_admin"],
    },
  },
} as const
