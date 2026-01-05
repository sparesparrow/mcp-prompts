// Temporary manual TypeScript bindings for cognitive.fbs
// This should be replaced with generated code from FlatBuffers schema

export enum PromptLayer {
  Unknown = 0,
  Perceptual = 1,
  Episodic = 2,
  Semantic = 3,
  Procedural = 4,
  MetaCognitive = 5,
  Transfer = 6,
  Evaluative = 7
}

export enum Domain {
  General = 0,
  SoftwareDevelopment = 1,
  MedicalAnalysis = 2,
  FinancialModeling = 3,
  CreativeProduction = 4,
  Infrastructure = 5,
  DataScience = 6,
  Security = 7
}

// Placeholder interfaces for other types that might be needed
export interface UUID {
  bytes: Uint8Array;
}

export interface Timestamp {
  seconds: bigint;
  nanoseconds: number;
}

export interface KeyValue {
  key: string;
  value: string;
  value_type?: string;
}

export interface Confidence {
  score: number;
  reasoning?: string;
  evidence_quality?: string;
  last_updated?: Timestamp;
}

export interface Statistics {
  usage_count: bigint;
  success_count: bigint;
  failure_count: bigint;
  average_duration_ms: number;
  last_used?: Timestamp;
  first_used?: Timestamp;
  peak_usage_period?: string;
}

export interface Version {
  major: number;
  minor: number;
  patch: number;
  label?: string;
}

export interface CognitivePrompt {
  base_prompt: any;
  layer: PromptLayer;
  domain: Domain;
  tags: string[];
  related_prompts?: UUID[];
  parent_prompt?: UUID;
  derived_from_episodes?: UUID[];
  abstraction_level?: number;
  applicability_score?: KeyValue[];
  statistics?: Statistics;
  effectiveness_by_context?: KeyValue[];
  last_updated?: Timestamp;
  version_history?: Version[];
}

export interface ProjectContext {
  project_type: any;
  primary_language?: string;
  languages?: string[];
  domain: Domain;
  build_system?: string;
  has_tests?: boolean;
  has_ci?: boolean;
  performance_critical?: boolean;
  safety_critical?: boolean;
  security_sensitive?: boolean;
  real_time_constraints?: boolean;
  detected_frameworks?: string[];
  confidence?: Confidence;
  detection_timestamp?: Timestamp;
  metadata?: KeyValue[];
}

export interface ProblemSignature {
  symptoms: string[];
  context_fingerprint?: string;
  error_patterns?: string[];
  affected_components?: string[];
  reproduction_conditions?: string[];
}

export interface InvestigationStep {
  step_number: number;
  action: string;
  tool_used?: string;
  findings?: string;
  led_to_solution?: boolean;
  duration_ms?: number;
}

export interface SolutionPattern {
  description: string;
  implementation_steps?: string[];
  validation_method?: string;
  side_effects?: string[];
  applicability_conditions?: string[];
}

export interface EpisodeMemory {
  id: UUID;
  name: string;
  problem_signature: ProblemSignature;
  context: ProjectContext;
  investigation_path?: InvestigationStep[];
  solution: SolutionPattern;
  success: boolean;
  cognitive_load?: number;
  generalization_cues?: string[];
  tags?: string[];
  created_at?: Timestamp;
  used_count?: number;
  effectiveness_score?: number;
  related_episodes?: UUID[];
}