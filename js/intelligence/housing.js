import { createDatasetJoinIndex } from "../data/join-engine.js";

export function buildHousingContext(location, resolver, datasets = []) {
  const dataset = datasets.find(d => d.concept === 'housing');
  if (!dataset) return { available:false };
  const index = dataset._joinIndex || createDatasetJoinIndex(dataset, resolver);
  const region = location.type === 'region' ? location : resolver.ancestorsOf(location).find(x => x.type === 'region');
  if (!region) return { available:false };
  const records = index.byLocation.get(String(region.psgc_code).trim().toUpperCase()) || [];
  const record = records[0];
  if (!record) return { available:false };
  const total=Number(record.total_housing_units_2020), occupied=Number(record.occupied_housing_units_2020);
  return {
    available:true, scope:'regional', region:region.name,
    totalHousingUnits:total, occupiedHousingUnits:occupied,
    occupancyRate:Number(record.occupancy_rate_2020), vacantHousingUnits:Math.max(0,total-occupied),
    source:{provider:dataset.provider,name:dataset.name,referenceDate:dataset.reference_date,datasetId:dataset.dataset_id,confidence:'official-source'}
  };
}
