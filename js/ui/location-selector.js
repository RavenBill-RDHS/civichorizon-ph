export function initLocationSelector(locations, resolver, cb) {
  const top = document.querySelector("#provinceSelect");
  const place = document.querySelector("#placeSelect");
  const barangay = document.querySelector("#barangaySelect");
  const check = document.querySelector("#checkButton");

  const provinces = locations
    .filter(x => x.type === "province")
    .sort((a, b) => a.name.localeCompare(b.name));

  const provinceRegionCodes = new Set(
    provinces.map(x => (x.correspondence_code || "").slice(0, 2))
  );

  const standaloneRegions = locations
    .filter(x => x.type === "region" && !provinceRegionCodes.has((x.correspondence_code || "").slice(0, 2)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const topItems = [...provinces, ...standaloneRegions]
    .sort((a, b) => a.name.localeCompare(b.name));

  fill(top, topItems, "Select a province / metro region");

  top.onchange = () => {
    const selected = resolver.getByPsgc(top.value);
    resetPlaceControls();

    if (!selected) return;

    const children = resolver.childrenOf(selected.psgc_code)
      .filter(x => x.type === "city" || x.type === "municipality")
      .sort((a, b) => a.name.localeCompare(b.name));

    fill(place, children, "Select a city / municipality");
    place.disabled = children.length === 0;

    if (children.length === 1) {
      place.value = children[0].psgc_code;
      place.dispatchEvent(new Event("change"));
    }
  };

  place.onchange = () => {
    const selected = resolver.getByPsgc(place.value);
    barangay.innerHTML = "";
    check.disabled = !selected;

    if (!selected) {
      barangay.disabled = true;
      return;
    }

    const children = resolver.childrenOf(selected.psgc_code)
      .filter(x => x.type === "barangay")
      .sort((a, b) => a.name.localeCompare(b.name));

    fill(barangay, children, "Select a barangay (optional)");
    barangay.disabled = children.length === 0;
  };

  check.onclick = () => {
    const selectedCode = barangay.value || place.value;
    const location = resolver.getByPsgc(selectedCode);
    const intent = document.querySelector('input[name="intent"]:checked')?.value || "exploring";

    if (location) cb.onCheck(location, intent);
  };

  function resetPlaceControls() {
    fill(place, [], "Select a city / municipality");
    fill(barangay, [], "Select a barangay (optional)");
    place.disabled = true;
    barangay.disabled = true;
    check.disabled = true;
  }
}

function fill(select, items, placeholder) {
  select.innerHTML = "";

  const option = document.createElement("option");
  option.value = "";
  option.textContent = placeholder;
  select.appendChild(option);

  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.psgc_code;
    option.textContent = item.name;
    select.appendChild(option);
  }
}
