/* eslint-disable @typescript-eslint/consistent-type-definitions */
/**
 * Tipos de la DB Supabase.
 *
 * Mantenido a mano hasta que corramos `npm run types:gen` (requiere supabase CLI
 * logueada). Cada tabla expone Row / Insert / Update — espejo del shape que
 * usaria la salida del codegen.
 *
 * IMPORTANTE: usamos `type` (no `interface`) para las filas porque las
 * interfaces no tienen index signature implicita y entonces no satisfacen
 * `Record<string, unknown>`, que es lo que pide `GenericTable` de
 * postgrest-js. Con `type` aliases si funciona, y la salida de `supabase gen
 * types` tambien usa `type` por la misma razon.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ProfileRole = 'familia' | 'pyme' | 'admin' | 'institucion' | 'personal_institucion';

export type ProfileRow = {
  id: string;
  role: ProfileRole | null;
  nombre: string | null;
  email: string;
  telefono: string | null;
  telefono_verificado: boolean | null;
  terms_version_aceptada: string | null;
  terms_accepted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ProfileInsert = {
  id: string;
  email: string;
  role?: ProfileRole | null;
  nombre?: string | null;
  telefono?: string | null;
  telefono_verificado?: boolean | null;
  terms_version_aceptada?: string | null;
  terms_accepted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ProfileUpdate = {
  id?: string;
  email?: string;
  role?: ProfileRole | null;
  nombre?: string | null;
  telefono?: string | null;
  telefono_verificado?: boolean | null;
  terms_version_aceptada?: string | null;
  terms_accepted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type GrupoTipo = 'aula' | 'sala' | 'curso' | 'comision';

export type GrupoRow = {
  id: string;
  nombre: string;
  zona: string;
  tipo: GrupoTipo;
  institucion_id: string | null;
  rango_familias: string | null;
  creado_por: string;
  invite_code: string;
  created_at: string | null;
  updated_at: string | null;
};

export type GrupoInsert = {
  id?: string;
  nombre: string;
  zona: string;
  tipo?: GrupoTipo;
  institucion_id?: string | null;
  rango_familias?: string | null;
  creado_por: string;
  invite_code?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type GrupoUpdate = Partial<GrupoRow>;

export type RolEnGrupo = 'creador' | 'admin' | 'miembro';

export type GrupoMiembroRow = {
  id: string;
  grupo_id: string;
  profile_id: string;
  rol_en_grupo: RolEnGrupo;
  created_at: string | null;
};

export type GrupoMiembroInsert = {
  id?: string;
  grupo_id: string;
  profile_id: string;
  rol_en_grupo?: RolEnGrupo;
  created_at?: string | null;
};

export type GrupoMiembroUpdate = Partial<GrupoMiembroRow>;

export type CategoriaRow = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  campos_obligatorios: Json;
  orden: number | null;
  activa: boolean | null;
  created_at: string | null;
};

export type NecesidadEstado =
  | 'recibiendo_ofertas'
  | 'en_votacion'
  | 'adjudicada'
  | 'en_produccion'
  | 'en_entrega'
  | 'pendiente_confirmacion_grupo'
  | 'completada'
  | 'cancelada'
  | 'disputada';

export type NecesidadRow = {
  id: string;
  grupo_id: string;
  creador_id: string;
  creador_tipo: string;
  categoria_id: string;
  titulo: string;
  descripcion: string;
  campos: Json;
  zona: string;
  presupuesto_min_centavos: number | null;
  presupuesto_max_centavos: number | null;
  fecha_limite: string | null;
  estado: NecesidadEstado;
  cap_ofertas: number;
  ofertas_count: number;
  foto_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type NecesidadInsert = {
  id?: string;
  grupo_id: string;
  creador_id: string;
  creador_tipo: string;
  categoria_id: string;
  titulo: string;
  descripcion: string;
  campos?: Json;
  zona: string;
  presupuesto_min_centavos?: number | null;
  presupuesto_max_centavos?: number | null;
  fecha_limite?: string | null;
  estado?: NecesidadEstado;
  cap_ofertas?: number;
  foto_url?: string | null;
};

export type NecesidadUpdate = Partial<NecesidadRow>;

export type OfertaEstado = 'presentada' | 'ganadora' | 'descartada' | 'retirada';
export type ModoEntrega = 'retiro' | 'envio' | 'ambos';

export type OfertaRow = {
  id: string;
  necesidad_id: string;
  pyme_id: string;
  precio_total_centavos: number;
  descripcion: string;
  tiempo_entrega_dias: number | null;
  estado: OfertaEstado;
  modo_entrega: ModoEntrega | null;
  created_at: string | null;
};

export type OfertaInsert = {
  id?: string;
  necesidad_id: string;
  pyme_id: string;
  precio_total_centavos: number;
  descripcion: string;
  tiempo_entrega_dias?: number | null;
  estado?: OfertaEstado;
  modo_entrega?: ModoEntrega | null;
};

export type OfertaUpdate = Partial<OfertaRow>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      grupos: {
        Row: GrupoRow;
        Insert: GrupoInsert;
        Update: GrupoUpdate;
        Relationships: [];
      };
      grupo_miembros: {
        Row: GrupoMiembroRow;
        Insert: GrupoMiembroInsert;
        Update: GrupoMiembroUpdate;
        Relationships: [];
      };
      categorias: {
        Row: CategoriaRow;
        Insert: Partial<CategoriaRow> & { slug: string; nombre: string };
        Update: Partial<CategoriaRow>;
        Relationships: [];
      };
      necesidades: {
        Row: NecesidadRow;
        Insert: NecesidadInsert;
        Update: NecesidadUpdate;
        Relationships: [];
      };
      ofertas: {
        Row: OfertaRow;
        Insert: OfertaInsert;
        Update: OfertaUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      crear_grupo: {
        Args: {
          p_nombre: string;
          p_zona: string;
          p_tipo: string;
          p_rango: string;
          p_inst_nombre?: string;
          p_inst_direccion?: string;
        };
        Returns: GrupoRow[];
      };
      join_grupo_by_code: {
        Args: { p_code: string };
        Returns: { grupo_id: string; nombre: string; ya_era_miembro: boolean }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
