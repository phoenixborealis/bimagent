// Enhanced BIM + Carbon Context for LLM
// This file provides a comprehensive structured context combining:
// - Raw IFC geometry data
// - Precomputed geometry aggregates
// - Material carbon factors
// - Carbon baseline calculations
// - Benchmarks and targets
// - Alternative scenarios
// - Reduction strategies
// - Data quality metrics
// - Operational carbon context
// - IFC write-back mapping

import { IFC_DATA } from "./ifcData.js";

// 1) Project-level summary

export const PROJECT_SUMMARY = {
  id: "ac20-fzk-haus",
  name: "AC20-FZK-Haus",
  name_pt_br: "Casa AC20-FZK",
  description_en:
    "Two-storey detached house used as a standard BIM benchmark model (AC20-FZK-Haus).",
  description_pt_br:
    "Casa unifamiliar de dois pavimentos usada como modelo de benchmark em BIM (AC20-FZK-Haus).",
  usage_type_en: "Single-family residential",
  usage_type_pt_br: "Residência unifamiliar",
  storeys_above_ground: 2,
  gross_floor_area_m2: 208.546,
  net_floor_area_m2: 173.342,
  floor_area_by_storey: [
    {
      storey_id: "2eyxpyOx95m90jmsXLOuR0",
      name_en: "Ground floor",
      name_de: "Erdgeschoss",
      name_pt_br: "Térreo",
      elevation_m: 0.0,
      net_floor_area_m2: 98.833
    },
    {
      storey_id: "273g3wqLzDtfYIl7qqkgcO",
      name_en: "Upper floor",
      name_de: "Dachgeschoss",
      name_pt_br: "Pavimento superior",
      elevation_m: 2.7,
      net_floor_area_m2: 74.509
    }
  ],
  element_counts: {
    walls_standard_case: 13,
    windows: 11,
    doors: 5,
    slabs: 4,
    beams: 4,
    members: 42,
    spaces: 7,
    railings: 2,
    stairs: 1
  },
  units: {
    length: "m",
    area: "m2",
    volume: "m3",
    mass: "kg",
    emissions: "kgCO2e"
  }
};

// 2) Geometry aggregates

export const GEOMETRY_AGGREGATES = {
  envelope: {
    wall_net_side_area_m2: 190.466,
    wall_gross_side_area_m2: 225.776,
    window_area_m2: 23.17,
    door_area_m2: 12.14,
    envelope_area_m2: 225.776,
    glazing_ratio_windows_only: 0.1026, // ≈10%
    glazing_plus_doors_ratio: 0.1564    // ≈16%
  },
  structure: {
    wall_net_volume_m3: 54.481,
    wall_gross_volume_m3: 64.754,
    slab_net_area_m2: 384.958,
    slab_net_volume_m3: 76.992
  },
  spaces: {
    count_spaces: 7,
    gross_floor_area_m2: 208.546,
    net_floor_area_m2: 173.342,
    average_clear_height_m: 2.714
  }
};

// 3) Material factors (embodied carbon coefficients)

export const MATERIAL_FACTORS = {
  unit_emissions: "kgCO2e",
  materials: [
    {
      id: "mat_concrete_structural",
      name_en: "Generic structural concrete",
      name_pt_br: "Concreto estrutural genérico",
      description_en:
        "In-situ reinforced concrete used for slabs and primary walls, cradle-to-gate (A1–A3).",
      typical_use: ["slabs", "structural_walls"],
      density_kg_per_m3: 2400,
      emission_factor_kgco2e_per_m3: 350.0
    },
    {
      id: "mat_concrete_structural_low_clinker",
      name_en: "Low-clinker structural concrete",
      name_pt_br: "Concreto estrutural com baixo clínquer",
      description_en:
        "Low-clinker or blended-cement concrete, approx. 25% lower GWP than baseline structural concrete, A1–A3.",
      typical_use: ["slabs", "structural_walls"],
      density_kg_per_m3: 2400,
      emission_factor_kgco2e_per_m3: 260.0 // ~25% less than 350
    },
    {
      id: "mat_masonry_block",
      name_en: "Generic concrete masonry block",
      name_pt_br: "Bloco de alvenaria de concreto genérico",
      description_en:
        "Standard concrete masonry unit, cradle-to-gate (A1–A3).",
      density_kg_per_m3: 1800,
      emission_factor_kgco2e_per_m3: 300
    },
    {
      id: "mat_glazing_double",
      name_en: "Generic double glazing",
      name_pt_br: "Vidro duplo genérico",
      description_en:
        "Standard double-glazed window unit, excluding frame, cradle-to-gate (A1–A3).",
      emission_factor_kgco2e_per_m2: 90.0
    },
    {
      id: "mat_door_wood_hollow",
      name_en: "Generic interior/terrace door (wood/hollow core)",
      name_pt_br: "Porta genérica (madeira/miolo oco)",
      emission_factor_kgco2e_per_m2: 50.0
    }
  ]
};

// 4) Carbon baseline (embodied only)

export const CARBON_BASELINE = {
  scope: "embodied_cradle_to_gate",
  scope_description_en:
    "Embodied carbon of structure and envelope only (A1–A3), plus a generic allowance for finishes and services. Prototype data for demo purposes.",
  total_embodied_kgco2e: 58936.4,
  intensity_kgco2e_per_m2: 282.6,
  reference_floor_area_m2: 208.546,
  by_category: [
    {
      id: "structural_concrete",
      name_en: "Structural concrete (walls + slabs)",
      name_pt_br: "Concreto estrutural (paredes + lajes)",
      material_id: "mat_concrete_structural",
      quantity_m3: 131.473,
      embodied_kgco2e: 46015.4,
      share_of_total_percent: 78.1
    },
    {
      id: "glazing",
      name_en: "Glazing (windows)",
      name_pt_br: "Esquadrias envidraçadas (janelas)",
      material_id: "mat_glazing_double",
      quantity_m2: 23.17,
      embodied_kgco2e: 2085.3,
      share_of_total_percent: 3.5
    },
    {
      id: "doors",
      name_en: "Doors (terrace + selected internal doors)",
      name_pt_br: "Portas (varanda + portas internas selecionadas)",
      material_id: "mat_door_wood_hollow",
      quantity_m2: 12.14,
      embodied_kgco2e: 607.0,
      share_of_total_percent: 1.0
    },
    {
      id: "other_finishes_and_services",
      name_en: "Other finishes, partitions, services (lumped)",
      name_pt_br:
        "Outros acabamentos, divisórias e instalações (consolidado)",
      material_id: null,
      quantity_proxy: "N/A",
      embodied_kgco2e: 10228.6,
      share_of_total_percent: 17.4
    }
  ]
};

// 5) Assumptions + LLM guidelines

export const ASSUMPTIONS = {
  scope: {
    modules_included: ["A1", "A2", "A3"],
    modules_excluded: [
      "A4",
      "A5",
      "B1",
      "B2",
      "B3",
      "B4",
      "B5",
      "B6",
      "B7",
      "C1",
      "C2",
      "C3",
      "C4",
      "D"
    ],
    text_en:
      "Only cradle-to-gate (A1–A3) embodied impacts are considered for the demo. No operational energy, no maintenance, and no end-of-life modelling."
  },
  data_quality: {
    status: "prototype",
    notes_en: [
      "IFC geometry and quantities come from the AC20-FZK-Haus benchmark model.",
      "Carbon factors are generic, mid-range values based on typical ranges from literature, not product-specific EPDs.",
      "Other finishes and services are grouped into a single lumped category for simplicity."
    ]
  },
  modelling_rules: {
    treat_wall_net_side_area_as_external_wall_area: true,
    treat_slab_net_volume_as_structural_concrete_volume: true,
    use_project_gross_floor_area_for_intensity: true
  },
  llm_guidelines: {
    never_invent_new_numeric_values: true,
    what_if_instructions_en:
      "When the user asks 'what if' questions that change geometry beyond available numbers, respond directionally (increase/decrease, rough percentages) instead of giving precise new totals.",
    language_preference_en:
      "User is Brazilian; use PT-BR for user-facing explanations of terms, but keep all internal keys and units in English."
  }
};

// 6) NEW: Benchmarks & targets

export const BENCHMARKS = {
  methodology_reference: {
    sources: [
      {
        id: "eu_ecb_db",
        name: "Embodied Carbon of European Buildings Database (EU-ECB-DB)",
        url: "https://zenodo.org/record/6671558"
      },
      {
        id: "clf_wblca_v2",
        name: "CLF Embodied Carbon Benchmark Report (WBLCA Study V2)",
        url: "https://carbonleadershipforum.org/the-embodied-carbon-benchmark-report/"
      }
    ],
    notes_en:
      "Values below are stylized ranges for demo purposes, aligned with published ranges for low-rise residential buildings."
  },
  building_type: "single_family_residential",
  region: "europe_generic",
  metric: "kgCO2e_per_m2_gfa_A1_A3",
  distribution: {
    // illustrative but in the ballpark of low-rise residential benchmarks
    p10: 180,
    p50: 300,
    p90: 500
  },
  targets: [
    {
      id: "near_term_target",
      label_en: "Near-term embodied carbon target 2030",
      label_pt_br: "Meta de carbono incorporado de curto prazo 2030",
      target_kgco2e_per_m2: 250
    },
    {
      id: "stretch_target",
      label_en: "Stretch target (net-zero ready envelope/structure)",
      label_pt_br: "Meta ambiciosa (estrutura/envoltória pronta para net-zero)",
      target_kgco2e_per_m2: 200
    }
  ]
};

// 7) NEW: Pre-computed design scenarios

export const SCENARIOS = {
  baseline_id: "baseline_current_design",
  scenarios: [
    {
      id: "baseline_current_design",
      label_en: "Current design (reference)",
      label_pt_br: "Projeto atual (referência)",
      intensity_kgco2e_per_m2: 282.6,
      total_kgco2e: 58936.4
    },
    {
      id: "low_clinker_concrete",
      label_en: "Low-clinker concrete in slabs and walls",
      label_pt_br: "Concreto com baixo clínquer em lajes e paredes",
      description_en:
        "Replace standard structural concrete with low-clinker mixes (~25% lower GWP factor) for all walls and slabs.",
      description_pt_br:
        "Substituir o concreto estrutural padrão por concretos com baixo clínquer (~25% menos GWP) em todas as lajes e paredes estruturais.",
      changed_materials: [
        {
          from_material_id: "mat_concrete_structural",
          to_material_id: "mat_concrete_structural_low_clinker",
          factor_change_percent: -25
        }
      ],
      intensity_kgco2e_per_m2: 230,
      total_kgco2e: 48000,
      reduction_vs_baseline_percent: 18.6
    },
    {
      id: "lighter_slab_plus_window_optimization",
      label_en: "Lighter slabs + reduced glazing",
      label_pt_br: "Lajes mais leves + redução de área envidraçada",
      description_en:
        "Reduce slab volume by 15% and window area by 20% while keeping floor area constant.",
      description_pt_br:
        "Reduzir o volume de laje em 15% e a área de janelas em 20%, mantendo a área de piso constante.",
      changes_summary_en: [
        "Slab net volume reduced from 76.99 to 65.44 m³ (approx.).",
        "Window area reduced from 23.17 to 18.54 m²."
      ],
      changes_summary_pt_br: [
        "Volume de laje reduzido de 76,99 para 65,44 m³ (aprox.).",
        "Área de janelas reduzida de 23,17 para 18,54 m²."
      ],
      intensity_kgco2e_per_m2: 210,
      total_kgco2e: 43500,
      reduction_vs_baseline_percent: 26.2
    }
  ]
};

// 8) NEW: Reduction strategies playbook

export const REDUCTION_STRATEGIES = {
  for_single_family_residential: [
    {
      id: "optimize_structural_concrete",
      name_en: "Optimize structural concrete use",
      name_pt_br: "Otimizar o uso de concreto estrutural",
      applies_to_categories: ["structural_concrete"],
      typical_reduction_range_percent: [10, 30],
      evidence_summary_en:
        "Literature and case studies report 10–30% embodied carbon reduction via structural rationalization, optimized spans, and efficient slab/wall thicknesses.",
      caveats_en: [
        "Requires structural engineering validation.",
        "May impact spans, vibration performance, acoustic behaviour and coordination with MEP."
      ]
    },
    {
      id: "switch_to_low_clinker_concrete",
      name_en: "Use low-clinker / blended cements",
      name_pt_br: "Usar concreto com baixo clínquer / cimentos compostos",
      applies_to_materials: ["mat_concrete_structural"],
      typical_reduction_range_percent: [20, 40],
      evidence_summary_en:
        "EPDs and classification schemes for low-clinker concretes typically show 20–40% lower GWP compared to baseline mixes.",
      caveats_en: [
        "Check local availability, codes and structural design assumptions.",
        "Verify curing times, strength development and durability with the supplier."
      ]
    },
    {
      id: "reduce_glazing_area",
      name_en: "Reduce non-essential glazing area",
      name_pt_br: "Reduzir área de vidro não essencial",
      applies_to_categories: ["glazing"],
      typical_reduction_range_percent: [5, 15],
      evidence_summary_en:
        "Reducing non-essential glazing and frame area can moderately reduce façade-related embodied carbon while also affecting thermal performance.",
      caveats_en: [
        "May impact daylight, views and architectural intent.",
        "Coordinate with thermal, daylight and comfort analysis."
      ]
    }
  ]
};

// 9) NEW: Data-quality metrics

export const DATA_QUALITY = {
  coverage: {
    share_of_structural_volume_with_factors_percent: 100,
    share_of_envelope_area_with_factors_percent: 95,
    share_of_total_building_mass_with_factors_percent: 90
  },
  sources: {
    lca_database_name: "Demo generic database",
    lca_database_region: "Europe, generic",
    lca_database_year: 2024
  },
  classification: {
    system: "none_for_demo",
    notes_en:
      "No explicit classification system (e.g. eBKP-H, Uniclass) is used in this prototype; amortization years are not applied."
  },
  known_gaps_en: [
    "MEP systems are not modelled explicitly.",
    "Interior finishes and partitions are lumped into a generic 'other' category.",
    "Foundations and substructure are not represented as separate categories."
  ]
};

// 10) NEW: Operational carbon stub

export const OPERATIONAL_CARBON = {
  assumed_lifetime_years: 50,
  reference_energy_use_intensity_kwh_per_m2_per_year: 70,
  grid_intensity_kgco2e_per_kwh_current: 0.25,
  grid_intensity_kgco2e_per_kwh_2050: 0.05,
  total_operational_kgco2e_lifetime_current_grid: 182500,
  notes_en: [
    "Values are stylized and for demo only, based on typical low-energy residential ranges.",
    "No dynamic retrofit measures or detailed system modelling are included.",
    "Scenario with future low-carbon grid is represented by the reduced grid intensity only."
  ]
};

// 11) NEW: IFC write-back mapping description

export const IFC_WRITEBACK = {
  target_property_set_name: "Pset_BIMCarbonResults",
  fields: [
    {
      ifc_property_name: "GWP_A1_A3_kgCO2e_per_m2",
      from_context_path: "carbon_baseline.intensity_kgco2e_per_m2",
      description_en:
        "Embodied carbon intensity for the building (A1–A3) normalized per m² of gross floor area."
    },
    {
      ifc_property_name: "GWP_A1_A3_total_kgCO2e",
      from_context_path: "carbon_baseline.total_embodied_kgco2e",
      description_en:
        "Total building embodied carbon for A1–A3 for the current scenario."
    },
    {
      ifc_property_name: "ScenarioId",
      from_context_path: "scenarios.baseline_id",
      description_en: "Identifier of the active carbon scenario used for this export."
    },
    {
      ifc_property_name: "Benchmark_p50_kgCO2e_per_m2",
      from_context_path: "benchmarks.distribution.p50",
      description_en:
        "Median embodied carbon benchmark for similar buildings, used for comparison."
    }
  ],
  notes_en:
    "In a full implementation, these values would be written back per element or per system, using element-level mappings and IFC GUID relationships, not only building-level totals."
};

// 12) Combined context we send to the LLM

export const BIM_CARBON_CONTEXT = {
  ifc_data: IFC_DATA,
  project_summary: PROJECT_SUMMARY,
  geometry_aggregates: GEOMETRY_AGGREGATES,
  material_factors: MATERIAL_FACTORS,
  carbon_baseline: CARBON_BASELINE,
  assumptions: ASSUMPTIONS,
  benchmarks: BENCHMARKS,
  scenarios: SCENARIOS,
  reduction_strategies: REDUCTION_STRATEGIES,
  data_quality: DATA_QUALITY,
  operational_carbon: OPERATIONAL_CARBON,
  ifc_writeback: IFC_WRITEBACK
};
