export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type BuildingData = {
  project: {
    name: string;
    location: {
      city: string;
      state: string;
      [key: string]: any;
    };
    typology: string;
    gross_floor_area_m2: number;
    construction_period: {
      start: string;
      end: string;
    };
    [key: string]: any;
  };
  inventory_results: {
    baseline_total_tco2e: number;
    project_total_tco2e: number;
    net_reduction_tco2e: number;
    potential_credits: number;
    scopes: {
        baseline: {
            scope1_machines_tco2e: number;
            scope2_electricity_tco2e: number;
            scope3_materials_and_transport_tco2e: number;
        };
        project: {
            scope1_machines_tco2e: number;
            scope2_electricity_tco2e: number;
            scope3_materials_and_transport_tco2e: number;
        };
    };
    [key: string]: any;
  };
  pdd_links: {
    official_verra_pd_example_pdf: string;
    ccb_vcs_pd_template_docx: string;
    ccb_vcs_monitoring_template_docx: string;
    [key: string]: any;
  };
  // Allow other properties for the AI context
  [key: string]: any;
};