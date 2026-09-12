export async function generateReport(i, language = "en") {
  const builders={en:buildEnglish,tl:buildTagalog,zh:buildChinese};
  const text=(builders[language]||buildEnglish)(i,i.identity.address||i.identity.name);
  return { text, provider:"CivicHorizon evidence synthesis", generated:false, language };
}

function listingEvidence(i){
  const records=i.housingListings?.records||[];
  if(!records.length) return {count:0};
  const contacts=records.filter(r=>r.contact).length;
  const descriptions=records.filter(r=>r.description).length;
  const prices=records.filter(r=>Number.isFinite(Number(r.price))).map(r=>Number(r.price));
  const verified=records.filter(r=>r.verification_status==='verified').length;
  const owner=records.filter(r=>r.verification_status==='owner_submitted').length;
  const types={};
  for(const r of records){const key=String(r.place_type||r.category||'Place').trim()||'Place';types[key]=(types[key]||0)+1;}
  return {count:records.length,contacts,descriptions,prices,verified,owner,types,names:records.slice(0,4).map(r=>r.name).filter(Boolean)};
}
function evidenceSentence(i){
  const e=listingEvidence(i); if(!e.count)return 'No mapped place records currently contribute local place evidence for this location.';
  const typeText=Object.entries(e.types).slice(0,4).map(([k,v])=>`${v} ${k}${v===1?'':'s'}`).join(', ');
  const priceText=e.prices.length?` Reported prices range from ₱${Math.min(...e.prices).toLocaleString('en-PH')} to ₱${Math.max(...e.prices).toLocaleString('en-PH')}.`:'';
  const verifiedText=e.verified?` ${e.verified} are marked CivicHorizon verified.`:'';
  return `The current map contains ${e.count} place record${e.count===1?'':'s'} (${typeText}). ${e.contacts} include contact information and ${e.descriptions} include descriptions.${priceText}${verifiedText} These records describe available public/community evidence; they do not guarantee current availability or business legitimacy.`;
}
function missingDecisionData(i){
  const available=new Set(Object.keys(i.datasets||{}).filter(k=>i.datasets[k]?.available));
  const missing=[];
  if(!available.has('flood_hazards'))missing.push('flood history/hazard');
  if(!available.has('transport'))missing.push('transport/commute');
  if(!available.has('schools'))missing.push('schools');
  if(!available.has('businesses') && !(i.housingListings?.records||[]).some(r=>String(r.place_type||'').toLowerCase().match(/business|store|restaurant|service|retail|sari/)))missing.push('business coverage');
  return missing;
}
function buildEnglish(i,address){
  let s=`${address}. `;
  const parts=[];
  if(i.population.available)parts.push(`the 2024 population is approximately ${fmt(i.population.value)} people`);
  if(i.geography.available)parts.push(`the mapped administrative area is approximately ${fmt(i.geography.areaKm2,1)} km²`);
  if(i.density.available)parts.push(`population density is about ${fmt(i.density.value,1)} people per km²`);
  if(parts.length)s+=`This location has ${parts.join('; ')}. `;
  const c=[];
  if(i.classification.cityClass)c.push(`classified as a ${formatCityClass(i.classification.cityClass)}`);
  if(i.classification.incomeClassification)c.push(`with ${formatIncomeClassification(i.classification.incomeClassification)} local-government income classification`);
  if(i.classification.urbanRural)c.push(`recorded as ${formatUrbanRural(i.classification.urbanRural)}`);
  if(c.length)s+=`Administrative context: ${c.join('; ')}. `;
  if(i.housing?.available)s+=`The surrounding region recorded ${fmt(i.housing.totalHousingUnits)} housing units in the 2020 Census, with an occupancy rate of ${fmt(i.housing.occupancyRate,1)}%; this is housing-stock context, not live vacancy data. `;
  s+=evidenceSentence(i)+' ';
  const missing=missingDecisionData(i);
  if(missing.length)s+=`For the broader place-decision questions CivicHorizon is designed to answer, ${missing.join(', ')} ${missing.length===1?'is':'are'} not yet represented by a loaded dataset here. `;
  if(i.intent==='living')s+=`For someone considering living here, the current evidence is most useful for comparing mapped places and basic location context; deeper safety, flood, school, transport and service coverage should be added only from defensible sources.`;
  else if(i.intent==='business')s+=`For a business-location decision, the current evidence can help identify mapped places and basic local context, while demand, foot traffic, transport and competitor coverage require additional validated datasets.`;
  else s+=`Use this as a decision-support snapshot and verify important details directly before acting.`;
  return s;
}
function buildTagalog(i,address){
  let s=`${address}. `; const parts=[];
  if(i.population.available)parts.push(`tinatayang ${fmt(i.population.value)} ang populasyon noong 2024`);
  if(i.geography.available)parts.push(`humigit-kumulang ${fmt(i.geography.areaKm2,1)} km² ang lawak`);
  if(i.density.available)parts.push(`humigit-kumulang ${fmt(i.density.value,1)} tao/km² ang population density`);
  if(parts.length)s+=`Sa kasalukuyang datos, ${parts.join('; ')}. `;
  if(i.housing?.available)s+=`May ${fmt(i.housing.totalHousingUnits)} housing units sa rehiyon noong 2020 at ${fmt(i.housing.occupancyRate,1)}% ang occupancy rate; background context ito at hindi live rental availability. `;
  const e=listingEvidence(i);
  if(e.count){const types=Object.entries(e.types).slice(0,4).map(([k,v])=>`${v} ${k}`).join(', ');s+=`May ${fmt(e.count)} place record${e.count===1?'':'s'} sa mapa (${types}). ${e.contacts} ang may contact, ${e.descriptions} ang may description, at ${e.verified} ang may CivicHorizon verified status. `;}else s+=`Wala pang place record na naka-map sa lugar na ito. `;
  const missing=missingDecisionData(i); if(missing.length)s+=`Hindi pa available dito ang ilang decision data gaya ng ${missing.join(', ')}. `;
  s+=`Dynamic ang ulat ayon sa kasalukuyang evidence at hindi ito garantiya ng presyo, availability, kaligtasan, o pagiging angkop ng lugar.`; return s;
}
function buildChinese(i,address){
  let s=`${address}。`; const parts=[];
  if(i.population.available)parts.push(`2024年人口约为 ${fmt(i.population.value)} 人`);
  if(i.geography.available)parts.push(`行政区域面积约 ${fmt(i.geography.areaKm2,1)} 平方公里`);
  if(i.density.available)parts.push(`人口密度约为每平方公里 ${fmt(i.density.value,1)} 人`);
  if(parts.length)s+=`当前基础信息：${parts.join('；')}。`;
  if(i.housing?.available)s+=`所属地区2020年约有 ${fmt(i.housing.totalHousingUnits)} 个住房单位，入住率为 ${fmt(i.housing.occupancyRate,1)}%；这是住房背景数据，不是实时出租数据。`;
  const e=listingEvidence(i); if(e.count)s+=`当前地图有 ${fmt(e.count)} 个地点记录，其中 ${e.contacts} 个有联系方式，${e.descriptions} 个有描述，${e.verified} 个标记为 CivicHorizon 已验证。`; else s+=`当前没有地点记录。`;
  const missing=missingDecisionData(i); if(missing.length)s+=`部分更深入的决策数据尚未加载，例如：${missing.join('、')}。`;
  s+=`报告会随着当前地点的实际证据变化；重要信息仍应在行动前直接核实。`; return s;
}
function formatCityClass(v){return ({HUC:"Highly Urbanized City",ICC:"Independent Component City",CC:"Component City"})[String(v).trim()]||v;}
function formatIncomeClassification(v){return /^[1-6](st|nd|rd|th)$/i.test(String(v).trim())?`${v}-class`:v;}
function formatUrbanRural(v){const x=String(v).trim().toUpperCase();return x==='U'?'urban':x==='R'?'rural':String(v).trim();}
function fmt(v,d=0){return Number(v).toLocaleString('en-PH',{maximumFractionDigits:d,minimumFractionDigits:d});}
