// Every figure shown in the app points back to one of these sources.
export const SOURCES = {
  rainfall: {
    type: 'Satellite rainfall',
    label: 'CHIRPS v3 monthly Africa rainfall estimates, Climate Hazards Center (UC Santa Barbara)',
    url: 'https://data.chc.ucsb.edu/products/CHIRPS/v3.0/monthly/africa/tifs/',
  },
  boundaries: {
    type: 'District boundaries',
    label: 'geoBoundaries, Rwanda administrative level 2 (district boundaries)',
    url: 'https://www.geoboundaries.org/',
  },
  cfsva: {
    type: 'Household drought survey',
    label: 'Rwanda CFSVA 2024, Figure 8.4, NISR Statistics Portal and WFP (households affected by drought, by district)',
    url: 'https://statistics.gov.rw/sites/default/files/documents/2025-07/Rwanda%20CFSVA%202024.pdf',
  },
}
