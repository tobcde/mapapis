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
  alias_mp: string | null;
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
  alias_mp?: string | null;
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
  alias_mp?: string | null;
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

export type NecesidadModalidad = 'grupal' | 'individual';

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
  fecha_limite_inscripcion: string | null;
  fecha_limite_entrega: string | null;
  link_referencia: string | null;
  modalidad: NecesidadModalidad;
  cantidad_por_alumno: number | null;
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
  fecha_limite_inscripcion?: string | null;
  fecha_limite_entrega?: string | null;
  link_referencia?: string | null;
  modalidad?: NecesidadModalidad;
  cantidad_por_alumno?: number | null;
  estado?: NecesidadEstado;
  cap_ofertas?: number;
  foto_url?: string | null;
};

/**
 * Shape de cada campo en `categorias.campos_obligatorios`.
 * Se usa para renderizar el formulario dinámico de publicar necesidad.
 */
export interface CampoSchema {
  key: string;
  label: string;
  type: 'int' | 'text' | 'date';
  required: boolean;
  min?: number;
  placeholder?: string;
  help?: string;
}

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

// ─── Alumnos ──────────────────────────────────────────────────────────────────

export type AlumnoRow = {
  id: string;
  grupo_id: string;
  nombre: string;
  dni: string | null;
  fecha_nacimiento: string | null;
  created_at: string | null;
};

export type AlumnoInsert = {
  id?: string;
  grupo_id: string;
  nombre: string;
  dni?: string | null;
  fecha_nacimiento?: string | null;
};

export type ProximoCumple = {
  alumno_id: string;
  grupo_id: string;
  nombre: string;
  fecha_nacimiento: string;
  proximo_cumple: string;
  dias_para_cumple: number;
  edad_que_cumple: number;
};

export type RelacionTutor = 'padre' | 'madre' | 'tutor' | 'encargado';

export type AlumnoTutorRow = {
  id: string;
  alumno_id: string;
  profile_id: string;
  relacion: RelacionTutor;
  created_at: string | null;
};

// ─── Inscripciones ────────────────────────────────────────────────────────────

export type NecesidadInscripcionRow = {
  id: string;
  necesidad_id: string;
  alumno_id: string;
  inscripto_por: string;
  created_at: string | null;
};

// ─── Votos ────────────────────────────────────────────────────────────────────

export type VotoOfertaRow = {
  id: string;
  oferta_id: string;
  alumno_id: string;
  votante_id: string;
  created_at: string | null;
};

// ─── Pymes ────────────────────────────────────────────────────────────────────

export type PymeTier = 0 | 1 | 2 | 3;
export type PymeEstado = 'activa' | 'suspendida' | 'pendiente';

export type PymeRow = {
  id: string;
  profile_id: string;
  nombre_comercial: string | null;
  descripcion: string | null;
  telefono: string | null;
  zonas: string[] | null;
  cuit: string | null;
  razon_social: string | null;
  categorias_ids: string[] | null;
  web_url: string | null;
  instagram: string | null;
  facebook: string | null;
  logo_url: string | null;
  anios_rubro: number | null;
  cbu: string | null;
  alias_cbu: string | null;
  tier: PymeTier | null;
  estado: PymeEstado | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PymeUpdate = Partial<PymeRow>;

// ─── necesidades_publicas (view) ──────────────────────────────────────────────

/** Misma shape que NecesidadRow — la view aplica RLS/filtros en la DB. */
export type NecesidadPublicaRow = NecesidadRow;

// ─── RPC return types ─────────────────────────────────────────────────────────

export type NecesidadProgresoResult = {
  inscriptos: number | null;
  total_alumnos: number | null;
  inscripcion_cerrada_at: string | null;
};

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
      alumnos: {
        Row: AlumnoRow;
        Insert: AlumnoInsert;
        Update: Partial<AlumnoRow>;
        Relationships: [];
      };
      alumno_tutores: {
        Row: AlumnoTutorRow;
        Insert: Omit<AlumnoTutorRow, 'id' | 'created_at'>;
        Update: Partial<AlumnoTutorRow>;
        Relationships: [];
      };
      necesidad_inscripciones: {
        Row: NecesidadInscripcionRow;
        Insert: Omit<NecesidadInscripcionRow, 'id' | 'created_at'>;
        Update: Partial<NecesidadInscripcionRow>;
        Relationships: [];
      };
      votos_oferta: {
        Row: VotoOfertaRow;
        Insert: Omit<VotoOfertaRow, 'id' | 'created_at'>;
        Update: Partial<VotoOfertaRow>;
        Relationships: [];
      };
      pymes: {
        Row: PymeRow;
        Insert: Omit<PymeRow, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: PymeUpdate;
        Relationships: [];
      };
    };
    Views: {
      necesidades_publicas: {
        Row: NecesidadPublicaRow;
        Relationships: [];
      };
      proximos_cumples: {
        Row: ProximoCumple;
        Relationships: [];
      };
    };
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
      necesidad_progreso: {
        Args: { p_necesidad: string };
        Returns: NecesidadProgresoResult[];
      };
      vote_oferta: {
        Args: { p_alumno: string; p_oferta: string };
        Returns: void;
      };
      unvote_oferta: {
        Args: { p_alumno: string; p_oferta: string };
        Returns: void;
      };
      adjudicar_oferta: {
        Args: { p_oferta: string };
        Returns: void;
      };
      cerrar_inscripcion: {
        Args: { p_necesidad: string };
        Returns: void;
      };
      reabrir_inscripcion: {
        Args: { p_necesidad: string };
        Returns: void;
      };
      inscribir_alumno: {
        Args: { p_necesidad: string; p_alumno: string };
        Returns: void;
      };
      desinscribir_alumno: {
        Args: { p_necesidad: string; p_alumno: string };
        Returns: void;
      };
      crear_oferta: {
        Args: {
          p_necesidad: string;
          p_precio_centavos: number;
          p_tiempo_dias: number | null;
          p_descripcion: string;
          p_modo_entrega?: string;
        };
        Returns: void;
      };
      actualizar_pyme: {
        Args: {
          p_nombre: string;
          p_descripcion?: string | null;
          p_telefono?: string | null;
          p_zonas?: string[] | null;
          p_cuit?: string | null;
          p_razon_social?: string | null;
          p_categorias_ids?: string[] | null;
          p_web_url?: string | null;
          p_instagram?: string | null;
          p_facebook?: string | null;
          p_logo_url?: string | null;
          p_anios_rubro?: number | null;
          p_cbu?: string | null;
          p_alias_cbu?: string | null;
        };
        Returns: void;
      };
      alumno_create_with_tutor: {
        Args: {
          p_grupo: string;
          p_nombre: string;
          p_dni?: string | null;
          p_relacion?: RelacionTutor;
          p_fecha_nacimiento?: string | null;
        };
        Returns: AlumnoRow[];
      };
      alumno_set_fecha_nacimiento: {
        Args: { p_alumno: string; p_fecha: string | null };
        Returns: void;
      };
      alumnos_merge: {
        Args: { p_alumno_keep: string; p_alumno_merge: string };
        Returns: void;
      };
      alumno_join_as_tutor: {
        Args: { p_alumno: string; p_relacion?: RelacionTutor };
        Returns: void;
      };
      alumno_set_mi_relacion: {
        Args: { p_alumno: string; p_relacion: RelacionTutor };
        Returns: void;
      };
      alumno_leave_as_tutor: {
        Args: { p_alumno: string };
        Returns: void;
      };
      promote_to_admin: {
        Args: { p_grupo: string; p_target: string };
        Returns: void;
      };
      demote_admin: {
        Args: { p_grupo: string; p_target: string };
        Returns: void;
      };
      kick_miembro: {
        Args: { p_grupo: string; p_target: string };
        Returns: void;
      };
      leave_grupo: {
        Args: { p_grupo: string };
        Returns: void;
      };
      regenerate_invite_code: {
        Args: { p_grupo: string };
        Returns: { invite_code: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
