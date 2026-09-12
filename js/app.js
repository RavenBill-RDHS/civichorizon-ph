import { loadLocations } from "./data/loader.js";
import { loadManifest } from "./data/manifest-loader.js";
import { loadOptionalDatasets } from "./data/dataset-loader.js";
import { createGenericAdapter } from "./data/adapters/generic.js";
import { createLocationResolver } from "./data/resolver.js";
import { buildLocationIntelligence } from "./intelligence/index.js";
import { generateReport } from "./ai/report.js";
import { initLocationSelector } from "./ui/location-selector.js";
import { initPlaceDiscovery } from "./ui/place-discovery.js";
import { renderSnapshot } from "./ui/snapshot.js";
import { renderReport } from "./ui/report.js";
import { renderDatasetCapabilities } from "./ui/datasets.js";
import { renderHousing } from "./ui/housing.js";
import { renderHousingListings } from "./ui/housing-listings.js";
import { initMap, focusLocation, showHousingListings, clearHousingListings, setHousingMapFilters } from "./map.js";
import { CIVICHORIZON_CONFIG } from "./config.js";
import { initAnalytics, trackEvent } from "./analytics.js";

const selectorView=document.querySelector("#selectorView"),resultView=document.querySelector("#resultView"),snapshot=document.querySelector("#snapshot"),housing=document.querySelector("#housing"),housingListings=document.querySelector("#housingListings"),report=document.querySelector("#report"),error=document.querySelector("#error");
let currentIntelligence=null;
let currentLanguage="en";
let listingState={query:"",type:"all"};
let mapFilters={living:true,business:true,other:true};

try {
  await initAnalytics();
  const [locations,manifest]=await Promise.all([loadLocations(),loadManifest()]);
  const resolver=createLocationResolver(locations);
  const {loaded,errors}=await loadOptionalDatasets(manifest);
  const externalDatasets=loaded.map(dataset=>{
    const definition=manifest.datasets.find(x=>x.dataset_id===dataset.dataset_id)||dataset;
    return {...dataset,records:createGenericAdapter(definition).normalizeAll(dataset.records)};
  });
  if(errors.length) console.warn("Optional dataset warnings:",errors);

  await initMap();
  initMapFilters();

  const explore = async (location,intent="living") => {
    if(!location)return;
    trackEvent("location_explore", { location_level: location.level || location.type, location_name: location.name });
    const intelligence=buildLocationIntelligence(location,resolver,intent,externalDatasets);
    currentIntelligence=intelligence; currentLanguage="en"; listingState={query:"",type:"all"};
    selectorView.classList.add("hidden"); resultView.classList.remove("hidden");
    snapshot.innerHTML=renderSnapshot(intelligence)+renderDatasetCapabilities(intelligence.datasets);
    housing.innerHTML=renderHousing(intelligence.housing);
    renderListingsAndMap();
    report.innerHTML="<p class='sub'>Preparing a location interpretation from the available evidence…</p>";
    await focusLocation(location,resolver);
    await showHousingListings(intelligence.housingListings?.records||[],resolver,mapFilters);
    renderListingsAndMap();
    report.innerHTML=renderReport(await generateReport(intelligence,currentLanguage));
  };

  initPlaceDiscovery(locations,resolver,location=>explore(location,"living"));
  initLocationSelector(locations,resolver,{onCheck:explore});

  const submitButton=document.querySelector("#submitListingButton");
  if(submitButton){
    const url=CIVICHORIZON_CONFIG.listingSubmissionFormUrl;
    if(url){
      submitButton.href=url;submitButton.target="_blank";submitButton.rel="noopener";
      submitButton.addEventListener("click",()=>trackEvent("listing_submission_click"));
    }
    else {submitButton.href="#";submitButton.addEventListener("click",e=>{e.preventDefault();alert("The public place-submission form has not been configured yet.");});}
  }

  initFeedback();

  function initFeedback(){
    const feedback=document.querySelector("#feedback");
    if(!feedback)return;
    const suggest=document.querySelector("#feedbackSuggest");
    const formUrl=CIVICHORIZON_CONFIG.feedbackFormUrl;
    if(formUrl){
      suggest.href=formUrl;
      suggest.hidden=false;
    }
    feedback.querySelectorAll("[data-feedback]").forEach(button=>{
      button.addEventListener("click",()=>{
        const value=button.dataset.feedback;
        trackEvent("feedback_useful", { useful: value });
        feedback.querySelectorAll("[data-feedback]").forEach(b=>b.classList.remove("selected"));
        button.classList.add("selected");
        document.querySelector("#feedbackThanks").hidden=false;
        if(value==="no" && formUrl){
          suggest.hidden=false;
        }
      });
    });
  }

  resultView.addEventListener("click",event=>{
    const button=event.target.closest("[data-listing-details]");
    if(button){trackEvent("listing_details_view");try{showListingDetails(JSON.parse(decodeURIComponent(button.dataset.listingDetails)));}catch(e){console.warn(e);}}
  });
  resultView.addEventListener("input",event=>{
    if(event.target.id!=="listingSearch")return; listingState.query=event.target.value; if(event.target.value.trim()) trackEvent("listing_search", { query: event.target.value.trim() }); renderListingsAndMap();
  });
  resultView.addEventListener("change",event=>{
    if(event.target.id!=="listingTypeFilter")return; listingState.type=event.target.value; renderListingsAndMap();
  });
  report.addEventListener("click",async event=>{
    const button=event.target.closest("[data-report-lang]");
    if(!button||!currentIntelligence)return;
    currentLanguage=button.dataset.reportLang; trackEvent("report_language_change", { language: currentLanguage }); report.innerHTML=renderReport(await generateReport(currentIntelligence,currentLanguage));
  });

  function initMapFilters(){
    document.querySelectorAll(".map-type-filter").forEach(input=>input.addEventListener("change",()=>{
      mapFilters[input.value]=input.checked; trackEvent("map_filter", { filter: input.value, enabled: input.checked });
      if(currentIntelligence) { setHousingMapFilters(mapFilters); renderListingsAndMap(false); }
    }));
  }
  function renderListingsAndMap(rerenderMap=true){
    if(!currentIntelligence)return;
    housingListings.innerHTML=renderHousingListings(currentIntelligence.housingListings,listingState);
    if(rerenderMap){
      const records=(currentIntelligence.housingListings?.records||[]).filter(r=>{
        const type=mapType(r); const q=String(listingState.query||'').trim().toLowerCase(); const hay=[r.name,r.place_type,r.address,r.description,r.contact].filter(Boolean).join(' ').toLowerCase();
        return mapFilters[type] && (listingState.type==='all'||type===listingState.type) && (!q||hay.includes(q));
      });
      showHousingListings(records,null,mapFilters);
    }
  }
  function mapType(r){const t=String(r?.place_type||r?.category||r?.business_type||'').toLowerCase(); if(/boarding|apartment|room for rent|homestay|hotel|hostel|dorm|residential|subdivision|lodging|accommodation|house|condo|rent/.test(t))return'living'; if(/sari|restaurant|retail|store|shop|service|business|laundry|market|canteen|salon|clinic|pharmacy|school|office|bank/.test(t))return'business'; return'other';}

  function showListingDetails(r){
    const modal=document.querySelector("#listingModal"),content=document.querySelector("#modalContent"); if(!modal||!content)return;
    const listingType = String(r.place_type || r.category || r.business_type || "").toLowerCase();
    const isBusiness = /sari|restaurant|retail|store|shop|service|business|laundry|market|canteen|salon|clinic|pharmacy|office|bank/.test(listingType);
    const isEnhanced = isBusiness && String(r.listing_tier || r.tier || "").toLowerCase() === "enhanced";

    // Basic business listings are intentionally limited to name + location.
    // Enhanced business listings may expose additional submitted fields.
    const rows = [
      ["Type", r.place_type || r.category],
      ["Address", r.address],
      ...(isBusiness && !isEnhanced ? [] : [
        ["Contact", r.contact],
        ["Price", r.price != null ? `₱${Number(r.price).toLocaleString("en-PH")}${r.price_period ? ` / ${r.price_period}` : ""}` : null],
        ["Opening hours", r.hours || r.opening_hours],
        ["Availability", r.availability && r.availability !== "unknown" ? r.availability : null],
        ["Description", r.description]
      ]),
      ["Listing", isBusiness ? (isEnhanced ? "Enhanced — Premium" : "Basic — Free") : null],
      ["Verification", r.verification_status],
      ["Source", r.source_url ? `<a href="${esc(r.source_url)}" target="_blank" rel="noopener">Open source ↗</a>` : null]
    ].filter(([,v]) => v);

    let photoHtml = "";
    if (isEnhanced && Array.isArray(r.photos) && r.photos.length) {
      photoHtml = `<div class="listing-photos">${r.photos.slice(0, 6).map(url => `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="${esc(r.name || "Business photo")}" loading="lazy"></a>`).join("")}</div>`;
    }

    content.innerHTML = `<div class="eyebrow">PLACE DETAILS</div>
      <h2 id="modalTitle">${esc(r.name || "Place")}</h2>
      ${isBusiness ? `<p class="listing-tier-note">${isEnhanced ? "Enhanced business listing" : "Basic business listing"}</p>` : ""}
      ${photoHtml}
      <div class="detail-grid">${rows.map(([k,v]) => `<div class="detail-item"><div class="detail-label">${esc(k)}</div><div class="detail-value">${k === "Source" ? v : esc(v)}</div></div>`).join("")}</div>`;
    modal.classList.remove("hidden"); modal.setAttribute("aria-hidden","false");
  }
  function closeListingDetails(){const modal=document.querySelector("#listingModal");if(modal){modal.classList.add("hidden");modal.setAttribute("aria-hidden","true");}}
  document.addEventListener("click",e=>{if(e.target.closest("[data-close-modal]"))closeListingDetails();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeListingDetails();});
  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
} catch(err) {
  console.error(err); error.hidden=false; error.textContent=location.protocol==="file:"?"This site must be opened through a local web server. Run START-CIVICHORIZON.bat, then open the displayed localhost address.":`CivicHorizon could not start: ${err.message}`;
}

document.querySelector("#backButton").onclick=()=>{trackEvent("back_to_map");clearHousingListings();resultView.classList.add("hidden");selectorView.classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"});};
