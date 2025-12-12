// Dashboard Data Adapter
// Transforms BIM_CARBON_CONTEXT into unified dashboard format
// Enforces unit system: kg internally, t for display only

import { BIM_CARBON_CONTEXT } from '../data/bimCarbonContext.js';
import { demoData } from '../data/demoData.js';

// Types
export interface UnifiedDashboardData {
  // Header
  projectName: string;
  location: { city: string; state: string };
  typology: string;
  methodology: string;
  availableScenarios: Scenario[];
  activeScenarioId: string;
  
  // KPIs (all in kg internally, converted to t for display)
  totalEmissionsKg: number; // kgCO₂e
  intensityKgPerM2: number; // kgCO₂e/m²
  credits: number; // From demoData shim until moved to context
  dataQuality: DataQualitySummary;
  
  // Emissions Comparison
  baselineEmissionsKg: number;
  activeScenarioEmissionsKg: number;
  bestScenarioEmissionsKg: number | null;
  reductionPercent: number;
  
  // Breakdown
  breakdownByCategory: CategoryBreakdown[];
  
  // Benchmarks
  percentilePosition: PercentilePosition;
  targetComparison: TargetComparison;
  
  // Scenarios
  scenarios: Scenario[];
  
  // Embodied vs Operational
  embodiedTotalKg: number;
  operationalLifetimeKg: number;
  operationalFutureKg: number;
  
  // Data Quality
  coveragePercentage: number;
  knownGaps: string[];
}

export interface Scenario {
  id: string;
  label_pt_br: string;
  label_en: string;
  intensity_kgco2e_per_m2: number;
  total_kgco2e: number;
  reduction_vs_baseline_percent?: number;
  changes_summary_pt_br?: string[];
}

export interface CategoryBreakdown {
  id: string;
  name_pt_br: string;
  quantity: number;
  quantityUnit: string;
  emissionsKg: number;
  sharePercent: number;
  reductionSuggestion?: string;
  coveragePercent?: number;
}

export interface PercentilePosition {
  percentile: number; // p10, p50, p90
  zone: 'very_low' | 'low' | 'medium_high' | 'very_high';
  description: string;
}

export interface TargetComparison {
  below2030Target: boolean;
  belowStretchTarget: boolean;
  distanceTo2030Target: number; // kg/m²
  distanceToStretchTarget: number; // kg/m²
}

export interface DataQualitySummary {
  overallCoverage: number; // 0-100
  structuralCoverage: number;
  envelopeCoverage: number;
  finishesCoverage: number;
  qualityLevel: 'high' | 'medium' | 'low';
}

// Unit conversion helpers (display only, never store in tons)
export function convertKgToTons(kg: number): number {
  return kg / 1000;
}

export function convertTonsToKg(tons: number): number {
  return tons * 1000;
}

// Calculate benchmark percentile position
export function calculateBenchmarkPercentile(
  intensity: number,
  benchmarks: typeof BIM_CARBON_CONTEXT.benchmarks
): PercentilePosition {
  const { p10, p50, p90 } = benchmarks.distribution;
  
  let percentile: number;
  let zone: PercentilePosition['zone'];
  let description: string;
  
  if (intensity < p10) {
    percentile = 10;
    zone = 'very_low';
    description = 'Muito baixo';
  } else if (intensity < p50) {
    percentile = 50;
    zone = 'low';
    description = 'Baixo';
  } else if (intensity < p90) {
    percentile = 90;
    zone = 'medium_high';
    description = 'Médio–alto';
  } else {
    percentile = 90;
    zone = 'very_high';
    description = 'Muito alto';
  }
  
  return { percentile, zone, description };
}

// Calculate target comparison
export function calculateTargetComparison(
  intensity: number,
  benchmarks: typeof BIM_CARBON_CONTEXT.benchmarks
): TargetComparison {
  const target2030 = benchmarks.targets.find(t => t.id === 'near_term_target');
  const targetStretch = benchmarks.targets.find(t => t.id === 'stretch_target');
  
  const target2030Value = target2030?.target_kgco2e_per_m2 || 250;
  const targetStretchValue = targetStretch?.target_kgco2e_per_m2 || 200;
  
  return {
    below2030Target: intensity < target2030Value,
    belowStretchTarget: intensity < targetStretchValue,
    distanceTo2030Target: intensity - target2030Value,
    distanceToStretchTarget: intensity - targetStretchValue,
  };
}

// Calculate data quality summary
export function computeDataQualitySummary(
  dataQuality: typeof BIM_CARBON_CONTEXT.data_quality
): DataQualitySummary {
  const coverage = dataQuality.coverage;
  // Map coverage fields from bimCarbonContext structure
  const structural = coverage.share_of_structural_volume_with_factors_percent || 0;
  const envelope = coverage.share_of_envelope_area_with_factors_percent || 0;
  const finishes = coverage.share_of_total_building_mass_with_factors_percent || 0;
  
  // Overall coverage is weighted average
  const overallCoverage = Math.round((structural + envelope + finishes) / 3);
  
  let qualityLevel: 'high' | 'medium' | 'low';
  if (overallCoverage >= 90) {
    qualityLevel = 'high';
  } else if (overallCoverage >= 70) {
    qualityLevel = 'medium';
  } else {
    qualityLevel = 'low';
  }
  
  return {
    overallCoverage,
    structuralCoverage: structural,
    envelopeCoverage: envelope,
    finishesCoverage: finishes,
    qualityLevel,
  };
}

// Main adapter function
export function createUnifiedDashboardData(
  activeScenarioId: string = 'baseline_current_design'
): UnifiedDashboardData {
  const ctx = BIM_CARBON_CONTEXT;
  
  // Validate schema version (basic check)
  if (!ctx.version || ctx.version !== '1.0.0') {
    console.warn(`BIM_CARBON_CONTEXT schema version mismatch. Expected 1.0.0, got ${ctx.version}`);
  }
  
  // Find active scenario
  const activeScenario = ctx.scenarios.scenarios.find(s => s.id === activeScenarioId) || 
    ctx.scenarios.scenarios.find(s => s.id === ctx.scenarios.baseline_id);
  
  if (!activeScenario) {
    throw new Error(`Scenario ${activeScenarioId} not found in BIM_CARBON_CONTEXT`);
  }
  
  // Find baseline scenario
  const baselineScenario = ctx.scenarios.scenarios.find(s => s.id === ctx.scenarios.baseline_id);
  if (!baselineScenario) {
    throw new Error(`Baseline scenario ${ctx.scenarios.baseline_id} not found`);
  }
  
  // Find best scenario (lowest intensity)
  const bestScenario = ctx.scenarios.scenarios.reduce((best, current) => {
    return current.intensity_kgco2e_per_m2 < best.intensity_kgco2e_per_m2 ? current : best;
  });
  
  // Calculate reduction percentage
  const reductionPercent = activeScenario.reduction_vs_baseline_percent || 
    ((baselineScenario.intensity_kgco2e_per_m2 - activeScenario.intensity_kgco2e_per_m2) / 
     baselineScenario.intensity_kgco2e_per_m2 * 100);
  
  // Build breakdown by category
  const breakdownByCategory: CategoryBreakdown[] = ctx.carbon_baseline.by_category.map(cat => {
    // Find reduction strategy for this category
    const strategies = ctx.reduction_strategies.for_single_family_residential;
    const strategy = strategies?.find(s => 
      s.applies_to_categories?.includes(cat.id) || 
      s.applies_to_materials?.includes(cat.material_id || '')
    );
    
    // Get recommendation text
    let recommendationText: string | undefined;
    if (strategy) {
      // Create recommendation from strategy
      recommendationText = strategy.name_pt_br;
      if (strategy.typical_reduction_range_percent) {
        recommendationText += ` (redução de ${strategy.typical_reduction_range_percent[0]}-${strategy.typical_reduction_range_percent[1]}%)`;
      }
    }
    
    // Determine coverage based on category type
    let coveragePercent = 100;
    if (cat.id === 'structural_concrete') {
      coveragePercent = ctx.data_quality.coverage.structural || 100;
    } else if (cat.id === 'glazing' || cat.id === 'doors') {
      coveragePercent = ctx.data_quality.coverage.envelope || 100;
    } else if (cat.id === 'other_finishes_and_services') {
      coveragePercent = ctx.data_quality.coverage.finishes || 50; // Lower for lumped category
    }
    
    return {
      id: cat.id,
      name_pt_br: cat.name_pt_br,
      quantity: cat.quantity_m3 || cat.quantity_m2 || 0,
      quantityUnit: cat.quantity_m3 ? 'm³' : cat.quantity_m2 ? 'm²' : 'N/A',
      emissionsKg: cat.embodied_kgco2e,
      sharePercent: cat.share_of_total_percent,
      reductionSuggestion: recommendationText,
      coveragePercent,
    };
  });
  
  // Calculate benchmark position
  const percentilePosition = calculateBenchmarkPercentile(
    activeScenario.intensity_kgco2e_per_m2,
    ctx.benchmarks
  );
  
  // Calculate target comparison
  const targetComparison = calculateTargetComparison(
    activeScenario.intensity_kgco2e_per_m2,
    ctx.benchmarks
  );
  
  // Data quality summary
  const dataQuality = computeDataQualitySummary(ctx.data_quality);
  
  // Credits from demoData shim (until moved to context)
  const credits = demoData.inventory_results?.potential_credits || 0;
  
  // Project metadata
  const projectName = ctx.project_summary.name_pt_br || demoData.project.name;
  const location = demoData.project.location;
  const typology = demoData.project.typology || ctx.project_summary.usage_type_pt_br;
  const methodology = demoData.project.methodologies?.[0] || 'Verra VM0032';
  
  return {
    projectName,
    location,
    typology,
    methodology,
    availableScenarios: ctx.scenarios.scenarios,
    activeScenarioId,
    
    totalEmissionsKg: activeScenario.total_kgco2e,
    intensityKgPerM2: activeScenario.intensity_kgco2e_per_m2,
    credits,
    dataQuality,
    
    baselineEmissionsKg: baselineScenario.total_kgco2e,
    activeScenarioEmissionsKg: activeScenario.total_kgco2e,
    bestScenarioEmissionsKg: bestScenario.id !== activeScenario.id ? bestScenario.total_kgco2e : null,
    reductionPercent,
    
    breakdownByCategory,
    
    percentilePosition,
    targetComparison,
    
    scenarios: ctx.scenarios.scenarios,
    
    embodiedTotalKg: ctx.carbon_baseline.total_embodied_kgco2e,
    operationalLifetimeKg: ctx.operational_carbon.total_operational_kgco2e_lifetime_current_grid,
    operationalFutureKg: ctx.operational_carbon.total_operational_kgco2e_lifetime_current_grid * 
      (ctx.operational_carbon.grid_intensity_kgco2e_per_kwh_2050 / 
       ctx.operational_carbon.grid_intensity_kgco2e_per_kwh_current),
    
    coveragePercentage: dataQuality.overallCoverage,
    knownGaps: ctx.data_quality.known_gaps_en.map(gap => {
      // Simple translation mapping (can be enhanced)
      const translations: Record<string, string> = {
        'B4–B5 (replacement)': 'B4–B5 (substituição)',
        'C1–C4 (end of life)': 'C1–C4 (fim de vida)',
        'A4–A5 (transport to site, construction)': 'A4–A5 (transporte ao canteiro, construção)',
      };
      return translations[gap] || gap;
    }),
  };
}
