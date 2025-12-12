// This file holds the "Brain" of the AI Agent.
// It matches the data shown on the Dashboard (Residencial Alto do Parque).

export const IFC_DATA = {
  "project": {
    "name": "Residencial Alto do Parque",
    "description": "Edifício residencial multifamiliar de alto padrão. O projeto busca certificação Verra através da redução de carbono incorporado via substituição de materiais.",
    "location": {
      "city": "São Paulo",
      "state": "SP",
      "climate_zone": "Tropical de Altitude"
    },
    "typology": "Torre Residencial",
    "gross_floor_area_m2": 7500,
    "storeys": 12,
    "construction_period": "2026-2027"
  },
  "carbon_inventory": {
    "status": "Simulado",
    "baseline_emissions_tco2e": 2954.0,
    "project_emissions_tco2e": 1900.0,
    "net_reduction_tco2e": 1054.0,
    "reduction_percentage": "35.6%",
    "potential_carbon_credits": 1054
  },
  "geometry_summary": {
    "source_file": "AC20-FZK-Haus.ifc (Modelo Proxy)",
    "total_elements": 1425,
    "breakdown": {
      "walls": 820,
      "windows": 260,
      "slabs": 45,
      "columns": 190,
      "beams": 110
    }
  },
  "key_materials": [
    {
      "material": "Concreto C25",
      "change": "Substituição por traço com escória/pozolana (Low-Carbon)",
      "impact": "Redução de 330 para 220 kgCO2e/m3"
    },
    {
      "material": "Aço CA-50",
      "change": "Uso de aço de forno elétrico a arco (EAF)",
      "impact": "Redução de 60% nas emissões do aço"
    },
    {
      "material": "Alvenaria",
      "change": "Blocos de solo-cimento vs Cerâmica convencional",
      "impact": "Menor energia de queima"
    }
  ],
  "scopes": {
    "scope1": "Maquinário e Combustíveis (312 tCO2e)",
    "scope2": "Eletricidade do Canteiro (19 tCO2e)",
    "scope3": "Materiais e Transporte (1569 tCO2e - Maior impacto)"
  },
  "methodology": {
    "standards": ["GHG Protocol", "Verra VM0032 (Inspiração)"],
    "exclusions": ["Uso e Operação (B6)", "Fim de Vida (C1-C4)"]
  }
};