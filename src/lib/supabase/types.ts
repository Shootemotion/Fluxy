export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          nombre: string | null;
          avatar_url: string | null;
          configuracion: Record<string, unknown>;
          moneda_principal: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      cuentas: {
        Row: {
          id: string;
          usuario_id: string;
          nombre: string;
          tipo: 'efectivo' | 'banco' | 'billetera' | 'broker' | 'caja_ahorro' | 'inversiones' | 'otro';
          moneda: string;
          saldo_inicial: number;
          color: string;
          icono: string | null;
          activa: boolean;
          orden: number;
          cbu: string | null;
          alias: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['cuentas']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['cuentas']['Insert']>;
      };
      categorias: {
        Row: {
          id: string;
          usuario_id: string | null;
          nombre: string;
          tipo: 'ingreso' | 'gasto' | 'transferencia' | 'objetivo';
          icono: string | null;
          color: string;
          es_sistema: boolean;
          activa: boolean;
          orden: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['categorias']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['categorias']['Insert']>;
      };
      subcategorias: {
        Row: {
          id: string;
          categoria_id: string;
          nombre: string;
          icono: string | null;
          activa: boolean;
          orden: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['subcategorias']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['subcategorias']['Insert']>;
      };
      movimientos: {
        Row: {
          id: string;
          usuario_id: string;
          fecha: string;
          tipo: 'ingreso' | 'gasto' | 'transferencia' | 'aporte_objetivo' | 'retiro_objetivo' | 'compra_activo' | 'venta_activo' | 'ajuste_valuacion';
          categoria_id: string | null;
          monto: number;
          moneda: string;
          tipo_cambio: number | null;
          cuenta_origen_id: string | null;
          cuenta_destino_id: string | null;
          objetivo_id: string | null;
          descripcion: string | null;
          metodo_carga: 'manual' | 'importado' | 'ia' | 'voz';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['movimientos']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['movimientos']['Insert']>;
      };
      objetivos: {
        Row: {
          id: string;
          usuario_id: string;
          nombre: string;
          descripcion: string | null;
          monto_objetivo: number;
          saldo_actual: number;
          fecha_meta: string | null;
          prioridad: 'alta' | 'media' | 'baja';
          color: string;
          icono: string | null;
          aporte_mensual_sugerido: number | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['objetivos']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['objetivos']['Insert']>;
      };
      valuaciones: {
        Row: {
          id: string;
          usuario_id: string;
          fecha: string;
          instrumento_nombre: string;
          monto: number;
          moneda: string;
          tipo_cambio: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['valuaciones']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['valuaciones']['Insert']>;
      };
      recurrentes: {
        Row: {
          id: string;
          usuario_id: string;
          nombre: string;
          monto: number;
          moneda: string;
          tipo: 'gasto' | 'ingreso';
          categoria_id: string | null;
          cuenta_id: string | null;
          dia_del_mes: number;
          fecha_inicio: string;
          fecha_fin: string | null;
          tasa_interes: number | null;
          activo: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['recurrentes']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['recurrentes']['Insert']>;
      };
      monedas: {
        Row: {
          codigo: string;
          nombre: string;
          simbolo: string;
          decimales: number;
          activa: boolean;
        };
        Insert: Database['public']['Tables']['monedas']['Row'];
        Update: Partial<Database['public']['Tables']['monedas']['Row']>;
      };
      tipos_cambio: {
        Row: {
          id: string;
          fecha: string;
          moneda_origen: string;
          moneda_destino: string;
          valor: number;
          fuente: 'manual' | 'api';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tipos_cambio']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['tipos_cambio']['Insert']>;
      };
      alertas: {
        Row: {
          id: string;
          usuario_id: string;
          tipo: string;
          mensaje: string;
          leida: boolean;
          datos: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['alertas']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['alertas']['Insert']>;
      };
    };
  };
};
