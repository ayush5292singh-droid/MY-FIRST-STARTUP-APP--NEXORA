/* =========================================================
   NEXORA LOCAL INTELLIGENCE
   Real OpenStreetMap + Overpass nearby search
   ========================================================= */

const state = {
  map: null,
  userLocation: null,
  userMarker: null,
  accuracyCircle: null,
  placeMarkers: [],
  places: [],
  selectedPlace: null,
  searchController: null,

  favourites: JSON.parse(
    localStorage.getItem("nexora_favourites") || "[]"
  ),

  helpers: JSON.parse(
    localStorage.getItem("nexora_helpers") || "[]"
  )
};


/* =========================================================
   ELEMENTS
   ========================================================= */

const $ = id => document.getElementById(id);

const elements = {
  homePage: $("homePage"),
  explorePage: $("explorePage"),
  helpersPage: $("helpersPage"),
  savedPage: $("savedPage"),

  pageTitle: $("pageTitle"),

  searchInput: $("searchInput"),
  ratingFilter: $("ratingFilter"),
  distanceFilter: $("distanceFilter"),
  availabilityFilter: $("availabilityFilter"),

  resultsList: $("resultsList"),
  resultCount: $("resultCount"),
  mapPlaceCount: $("mapPlaceCount"),

  mapStatus: $("mapStatus"),
  searchStatus: $("searchStatus"),
  statusDot: $("statusDot"),

  sideLocation: $("sideLocation"),
  topLocationText: $("topLocationText"),

  loadingScreen: $("loadingScreen"),
  loadingText: $("loadingText"),

  placeModal: $("placeModal"),
  placeDetails: $("placeDetails"),

  helperModal: $("helperModal"),
  helperForm: $("helperForm"),

  helpersList: $("helpersList"),
  favouritesList: $("favouritesList")
};


/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

function showPage(page) {

  document.querySelectorAll(".page").forEach(section => {
    section.classList.remove("active");
  });

  const target = $(`${page}Page`);

  if (target) {
    target.classList.add("active");
  }

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle(
      "active",
      btn.dataset.page === page
    );
  });

  const titles = {
    home: "Find what you need. Nearby.",
    explore: "Search real places around you.",
    helpers: "Your personal helper network.",
    saved: "Your saved places."
  };

  elements.pageTitle.textContent =
    titles[page] || titles.home;

  if (page === "explore") {

    setTimeout(() => {

      if (state.map) {
        state.map.invalidateSize();
      }

    }, 150);
  }

  if (page === "helpers") {
    renderHelpers();
  }

  if (page === "saved") {
    renderFavourites();
  }
}


document.querySelectorAll(".nav-btn").forEach(btn => {

  btn.addEventListener("click", () => {
    showPage(btn.dataset.page);
  });

});


$("startExploreBtn").addEventListener("click", () => {

  showPage("explore");

  if (!state.userLocation) {
    locateUser();
  }

});


$("heroLocateBtn").addEventListener("click", () => {
  showPage("explore");
  locateUser();
});


/* =========================================================
   MAP
   ========================================================= */

function initMap() {

  state.map = L.map("map", {
    zoomControl: true,
    attributionControl: true
  }).setView([20.5937, 78.9629], 5);


  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        '&copy; OpenStreetMap contributors'
    }
  ).addTo(state.map);

}


function createUserIcon() {

  return L.divIcon({
    className: "",
    html: `<div class="user-location-marker"></div>`,
    iconSize: [20,20],
    iconAnchor: [10,10]
  });

}


function createPlaceIcon() {

  return L.divIcon({
    className: "",
    html: `<div class="place-marker">●</div>`,
    iconSize: [28,28],
    iconAnchor: [14,14]
  });

}


/* =========================================================
   LOCATION
   ========================================================= */

function locateUser() {

  if (!navigator.geolocation) {

    setStatus(
      "Your browser does not support location.",
      "error"
    );

    return;
  }


  setStatus(
    "Requesting your location...",
    "loading"
  );

  elements.topLocationText.textContent = "Locating...";


  navigator.geolocation.getCurrentPosition(

    position => {

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const accuracy = position.coords.accuracy || 50;

      state.userLocation = {
        lat,
        lon,
        accuracy
      };


      updateUserLocationOnMap();

      updateLocationText();

      setStatus(
        "Location ready",
        "ready"
      );

      elements.topLocationText.textContent =
        "Location ready";


      if (
        !$("explorePage").classList.contains("active")
      ) {
        showPage("explore");
      }

    },

    error => {

      console.error(error);

      let message =
        "Location permission was not granted.";

      if (error.code === 1) {
        message =
          "Please allow location permission.";
      }

      if (error.code === 2) {
        message =
          "Your location could not be found.";
      }

      if (error.code === 3) {
        message =
          "Location request timed out.";
      }

      setStatus(message, "error");

      elements.topLocationText.textContent =
        "Locate me";

    },

    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000
    }

  );

}


function updateUserLocationOnMap() {

  if (!state.map || !state.userLocation) {
    return;
  }

  const {
    lat,
    lon,
    accuracy
  } = state.userLocation;


  if (state.userMarker) {
    state.map.removeLayer(state.userMarker);
  }

  if (state.accuracyCircle) {
    state.map.removeLayer(state.accuracyCircle);
  }


  state.userMarker = L.marker(
    [lat, lon],
    {
      icon: createUserIcon(),
      zIndexOffset: 1000
    }
  )
  .addTo(state.map)
  .bindPopup(
    "<div class='popup-title'>YOU ARE HERE</div>" +
    "<div class='popup-info'>" +
    "Your current location</div>"
  );


  state.accuracyCircle = L.circle(
    [lat, lon],
    {
      radius: accuracy,
      color: "#54f39a",
      fillOpacity: .04,
      weight: 1
    }
  ).addTo(state.map);


  state.map.setView(
    [lat, lon],
    15,
    { animate: true }
  );

}


function updateLocationText() {

  if (!state.userLocation) {
    return;
  }

  const {
    lat,
    lon
  } = state.userLocation;

  const short =
    `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  elements.sideLocation.textContent = short;

}


/* =========================================================
   STATUS
   ========================================================= */

function setStatus(message, type = "") {

  elements.mapStatus.textContent = message;

  elements.statusDot.className =
    "status-dot";

  if (type === "ready") {
    elements.statusDot.classList.add("ready");
  }

  if (type === "error") {
    elements.statusDot.classList.add("error");
  }

}


/* =========================================================
   SEARCH TERMS
   ========================================================= */

function getSearchTerms(searchText) {

  const text =
    (searchText || "")
      .trim()
      .toLowerCase();


  if (!text) {
    return [];
  }


  const aliases = {

    pharmacy: [
      "pharmacy",
      "chemist",
      "medical"
    ],

    plumber: [
      "plumber",
      "plumbing"
    ],

    electrician: [
      "electrician",
      "electrical"
    ],

    mechanic: [
      "mechanic",
      "auto repair",
      "car repair"
    ],

    grocery: [
      "grocery",
      "supermarket",
      "convenience"
    ],

    restaurant: [
      "restaurant",
      "food"
    ],

    hardware: [
      "hardware",
      "hardware shop"
    ]

  };


  if (aliases[text]) {
    return aliases[text];
  }


  return text
    .split(/[,\s]+/)
    .filter(Boolean)
    .slice(0, 5);

}


function escapeRegex(value) {

  return String(value)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

}


/* =========================================================
   OVERPASS QUERY
   ========================================================= */

function buildOverpassQuery(
  searchText,
  radius
) {

  const {
    lat,
    lon
  } = state.userLocation;


  const terms =
    getSearchTerms(searchText);


  /*
    Empty search means "everything nearby".
  */

  if (!terms.length) {

    return `
[out:json][timeout:30];

(
  nwr["name"](around:${radius},${lat},${lon});
  nwr["shop"](around:${radius},${lat},${lon});
  nwr["amenity"](around:${radius},${lat},${lon});
  nwr["craft"](around:${radius},${lat},${lon});
  nwr["office"](around:${radius},${lat},${lon});
  nwr["healthcare"](around:${radius},${lat},${lon});
);

out center tags;
`;

  }


  const regex =
    terms
      .map(escapeRegex)
      .join("|");


  return `
[out:json][timeout:30];

(
  nwr["name"~"${regex}",i"](around:${radius},${lat},${lon});

  nwr["shop"~"${regex}",i"](around:${radius},${lat},${lon});

  nwr["amenity"~"${regex}",i"](around:${radius},${lat},${lon});

  nwr["craft"~"${regex}",i"](around:${radius},${lat},${lon});

  nwr["office"~"${regex}",i"](around:${radius},${lat},${lon});

  nwr["healthcare"~"${regex}",i"](around:${radius},${lat},${lon});
);

out center tags;
`;

}


/* =========================================================
   SEARCH
   ========================================================= */

async function searchPlaces() {

  if (!state.userLocation) {

    setStatus(
      "Locate yourself before searching.",
      "error"
    );

    locateUser();

    return;
  }


  const searchText =
    elements.searchInput.value.trim();


  const radius =
    Number(elements.distanceFilter.value);


  const minRating =
    Number(elements.ratingFilter.value);


  const availability =
    elements.availabilityFilter.value;


  showLoading(
    "Finding nearby places..."
  );


  elements.searchStatus.textContent =
    "Searching real map data...";


  try {

    if (state.searchController) {
      state.searchController.abort();
    }

    state.searchController =
      new AbortController();


    const query =
      buildOverpassQuery(
        searchText,
        radius
      );


    /*
      Multiple public Overpass endpoints are tried.
      This makes the search more resilient if one endpoint
      is temporarily busy.
    */

    const endpoints = [

      "https://overpass-api.de/api/interpreter",

      "https://overpass.kumi.systems/api/interpreter",

      "https://overpass.private.coffee/api/interpreter"

    ];


    let data = null;
    let lastError = null;


    for (const endpoint of endpoints) {

      try {

        const response =
          await fetch(
            endpoint,
            {
              method: "POST",
              body: query,
              signal:
                state.searchController.signal
            }
          );


        if (!response.ok) {
          throw new Error(
            `Overpass HTTP ${response.status}`
          );
        }


        data = await response.json();

        if (data && data.elements) {
          break;
        }

      } catch (error) {

        lastError = error;

      }

    }


    if (!data) {
      throw lastError ||
        new Error("Search failed.");
    }


    let places =
      parsePlaces(data.elements || []);


    places =
      places.filter(place => {

        if (
          minRating > 0 &&
          place.rating !== null &&
          place.rating < minRating
        ) {
          return false;
        }

        /*
          If rating isn't available, don't falsely reject
          the place because OSM has no rating.
        */

        if (
          minRating > 0 &&
          place.rating === null
        ) {
          return false;
        }

        return true;

      });


    places =
      applyAvailabilityFilter(
        places,
        availability
      );


    places.sort(
      (a,b) =>
        a.distance -
        b.distance
    );


    state.places = places;


    renderMapMarkers();

    renderResults();


    elements.searchStatus.textContent =
      places.length
        ? `${places.length} places found`
        : "No matching places found";


  } catch (error) {

    if (error.name === "AbortError") {
      return;
    }


    console.error(error);


    state.places = [];

    clearPlaceMarkers();

    renderResults();


    elements.searchStatus.textContent =
      "Search failed. Try again.";

    setStatus(
      "Map search temporarily unavailable.",
      "error"
    );

  } finally {

    hideLoading();

  }

}


/* =========================================================
   PARSE OSM RESULTS
   ========================================================= */

function parsePlaces(elementsArray) {

  const seen = new Set();
  const places = [];


  for (const element of elementsArray) {

    const tags = element.tags || {};


    const lat =
      element.lat ??
      element.center?.lat;


    const lon =
      element.lon ??
      element.center?.lon;


    if (
      typeof lat !== "number" ||
      typeof lon !== "number"
    ) {
      continue;
    }


    const name =
      tags.name ||
      tags["name:en"] ||
      "Unnamed place";


    const id =
      `${element.type}-${element.id}`;


    if (seen.has(id)) {
      continue;
    }

    seen.add(id);


    const distance =
      calculateDistance(
        state.userLocation.lat,
        state.userLocation.lon,
        lat,
        lon
      );


    const category =
      getCategory(tags);


    const rating =
      getRating(tags);


    const opening =
      getOpening(tags);


    const address =
      buildAddress(tags);


    const phone =
      tags.phone ||
      tags["contact:phone"] ||
      "";


    const website =
      tags.website ||
      tags["contact:website"] ||
      "";


    places.push({

      id,

      name,

      lat,

      lon,

      distance,

      category,

      rating,

      opening,

      address,

      phone,

      website,

      tags

    });

  }


  return places;

}


/* =========================================================
   CATEGORY
   ========================================================= */

function getCategory(tags) {

  if (tags.amenity) {
    return prettify(tags.amenity);
  }

  if (tags.shop) {
    return prettify(tags.shop);
  }

  if (tags.craft) {
    return prettify(tags.craft);
  }

  if (tags.healthcare) {
    return prettify(tags.healthcare);
  }

  if (tags.office) {
    return prettify(tags.office);
  }

  return "Place";

}


function prettify(value) {

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());

}


/* =========================================================
   RATING
   ========================================================= */

function getRating(tags) {

  const possible = [

    tags.rating,

    tags.stars,

    tags["contact:rating"],

    tags["survey:rating"]

  ];


  for (const value of possible) {

    const number =
      parseFloat(value);


    if (
      Number.isFinite(number) &&
      number >= 0 &&
      number <= 5
    ) {
      return number;
    }

  }


  return null;

}


/* =========================================================
   OPENING HOURS
   ========================================================= */

function getOpening(tags) {

  const hours =
    tags.opening_hours ||
    tags["opening_hours:covid19"];


  if (!hours) {

    return {
      known: false,
      text: "Hours not listed"
    };

  }


  return {
    known: true,
    text: hours
  };

}


function applyAvailabilityFilter(
  places,
  filter
) {

  if (filter === "any") {
    return places;
  }


  if (filter === "known") {

    return places.filter(
      place => place.opening.known
    );

  }


  if (filter === "open") {

    return places.filter(
      place =>
        place.opening.known &&
        isOpenNow(
          place.opening.text
        )
    );

  }


  return places;

}


/*
  This handles common simple opening-hours formats.
  Complex OSM schedules are left as "check hours".
*/

function isOpenNow(hours) {

  if (!hours) {
    return false;
  }


  const text =
    hours.toLowerCase();


  if (
    text.includes("24/7")
  ) {
    return true;
  }


  if (
    text.includes("closed")
  ) {
    return false;
  }


  const now =
    new Date();


  const current =
    now.getHours() * 60 +
    now.getMinutes();


  const matches =
    hours.match(
      /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/
    );


  if (!matches) {

    /*
      We cannot safely interpret every OSM schedule.
      Don't pretend it is open.
    */

    return false;

  }


  const start =
    Number(matches[1]) * 60 +
    Number(matches[2]);


  const end =
    Number(matches[3]) * 60 +
    Number(matches[4]);


  if (end < start) {
    return (
      current >= start ||
      current <= end
    );
  }


  return (
    current >= start &&
    current <= end
  );

}


/* =========================================================
   ADDRESS
   ========================================================= */

function buildAddress(tags) {

  const parts = [

    tags["addr:housenumber"],

    tags["addr:street"],

    tags["addr:suburb"],

    tags["addr:city"],

    tags["addr:postcode"]

  ].filter(Boolean);


  if (parts.length) {
    return parts.join(", ");
  }


  return "Address not listed in map data.";

}


/* =========================================================
   DISTANCE
   ========================================================= */

function calculateDistance(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const R = 6371;


  const dLat =
    toRadians(lat2 - lat1);


  const dLon =
    toRadians(lon2 - lon1);


  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) ** 2;


  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );


  return R * c;

}


function toRadians(value) {

  return value *
    Math.PI /
    180;

}


function formatDistance(km) {

  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }

  return `${km.toFixed(1)} km`;

}


/* =========================================================
   MAP MARKERS
   ========================================================= */

function clearPlaceMarkers() {

  state.placeMarkers.forEach(
    marker => state.map.removeLayer(marker)
  );

  state.placeMarkers = [];

}


function renderMapMarkers() {

  if (!state.map) {
    return;
  }


  clearPlaceMarkers();


  state.places.forEach(place => {

    const marker =
      L.marker(
        [place.lat, place.lon],
        {
          icon: createPlaceIcon()
        }
      )
      .addTo(state.map);


    marker.bindPopup(
      createPopup(place)
    );


    marker.on(
      "click",
      () => {

        state.selectedPlace =
          place;

        highlightResult(
          place.id
        );

      }
    );


    state.placeMarkers.push(
      marker
    );

  });


  if (
    state.userLocation &&
    state.places.length
  ) {

    const points = [
      [
        state.userLocation.lat,
        state.userLocation.lon
      ],

      ...state.places.map(
        place => [
          place.lat,
          place.lon
        ]
      )

    ];


    state.map.fitBounds(
      L.latLngBounds(points),
      {
        padding: [35,35],
        maxZoom: 16
      }
    );

  }


  elements.mapPlaceCount.textContent =
    `${state.places.length} places`;

}


function createPopup(place) {

  return `

    <div class="popup-title">
      ${escapeHTML(place.name)}
    </div>

    <div class="popup-info">

      ${escapeHTML(place.category)}
      <br>

      ${formatDistance(place.distance)}

      ${
        place.rating !== null
          ? `<br>⭐ ${place.rating.toFixed(1)} / 5`
          : ""
      }

    </div>

  `;

}


/* =========================================================
   RESULTS
   ========================================================= */

function renderResults() {

  const places =
    state.places;


  elements.resultCount.textContent =
    `${places.length} ${
      places.length === 1
        ? "place"
        : "places"
    }`;


  if (!places.length) {

    elements.resultsList.innerHTML = `

      <div class="empty-state">

        <div class="empty-icon">⌕</div>

        <h3>No places found</h3>

        <p>
          Try increasing the radius,
          changing your search,
          or choosing another category.
        </p>

      </div>

    `;

    return;

  }


  elements.resultsList.innerHTML =
    places.map(
      place => createResultCard(place)
    ).join("");


  elements.resultsList
    .querySelectorAll("[data-place-id]")
    .forEach(card => {

      card.addEventListener(
        "click",
        event => {

          if (
            event.target.closest("button")
          ) {
            return;
          }

          const place =
            state.places.find(
              item =>
                item.id ===
                card.dataset.placeId
            );

          if (place) {
            focusPlace(place);
          }

        }
      );

    });


  elements.resultsList
    .querySelectorAll("[data-action]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const place =
            state.places.find(
              item =>
                item.id ===
                button.dataset.placeId
            );

          if (!place) {
            return;
          }


          const action =
            button.dataset.action;


          if (action === "details") {
            openPlace(place);
          }


          if (action === "directions") {
            openDirections(place);
          }


          if (action === "save") {
            toggleFavourite(place);
          }

        }
      );

    });

}


function createResultCard(place) {

  const saved =
    isFavourite(place.id);


  const ratingHTML =
    place.rating !== null
      ? `<span class="rating">
           ★ ${place.rating.toFixed(1)}
         </span>`
      : `<span>Rating unavailable</span>`;


  const openingHTML =
    place.opening.known
      ? `<span class="open">
           🕐 ${escapeHTML(place.opening.text)}
         </span>`
      : `<span>
           🕐 Hours unavailable
         </span>`;


  return `

    <article
      class="result-card"
      data-place-id="${escapeHTML(place.id)}"
    >

      <div class="result-top">

        <div>

          <div class="result-name">
            ${escapeHTML(place.name)}
          </div>

          <div class="result-type">
            ${escapeHTML(place.category)}
          </div>

        </div>

        <div class="result-distance">
          ${formatDistance(place.distance)}
        </div>

      </div>


      <div class="result-meta">

        ${ratingHTML}

        &nbsp; • &nbsp;

        ${openingHTML}

        <br>

        📍 ${escapeHTML(place.address)}

      </div>


      <div class="result-actions">

        <button
          data-action="details"
          data-place-id="${escapeHTML(place.id)}"
        >
          DETAILS
        </button>

        <button
          data-action="directions"
          data-place-id="${escapeHTML(place.id)}"
        >
          DIRECTIONS
        </button>

        <button
          data-action="save"
          data-place-id="${escapeHTML(place.id)}"
        >
          ${saved ? "★ SAVED" : "☆ SAVE"}
        </button>

      </div>

    </article>

  `;

}


/* =========================================================
   FOCUS PLACE
   ========================================================= */

function focusPlace(place) {

  state.selectedPlace =
    place;


  if (state.map) {

    state.map.setView(
      [place.lat, place.lon],
      17,
      { animate: true }
    );

  }


  const marker =
    state.placeMarkers.find(
      item => {

        const position =
          item.getLatLng();

        return (
          Math.abs(position.lat - place.lat) < 0.000001 &&
          Math.abs(position.lng - place.lon) < 0.000001
        );

      }
    );


  if (marker) {
    marker.openPopup();
  }


  highlightResult(place.id);

}


function highlightResult(id) {

  document
    .querySelectorAll(".result-card")
    .forEach(card => {

      card.classList.toggle(
        "selected",
        card.dataset.placeId === id
      );

    });

}


/* =========================================================
   PLACE DETAILS
   ========================================================= */

function openPlace(place) {

  state.selectedPlace =
    place;


  const website =
    place.website
      ? `
        <a
          href="${safeURL(place.website)}"
          target="_blank"
          rel="noopener"
        >
          Website
        </a>
      `
      : "Not listed";


  elements.placeDetails.innerHTML = `

    <div class="place-detail">

      <small>${escapeHTML(place.category)}</small>

      <h2>${escapeHTML(place.name)}</h2>

      <div class="place-address">
        📍 ${escapeHTML(place.address)}
      </div>


      <div class="detail-grid">

        <div class="detail-box">

          <small>DISTANCE</small>

          <strong>
            ${formatDistance(place.distance)}
          </strong>

        </div>


        <div class="detail-box">

          <small>RATING</small>

          <strong>
            ${
              place.rating !== null
                ? `⭐ ${place.rating.toFixed(1)} / 5`
                : "Not available"
            }
          </strong>

        </div>


        <div class="detail-box">

          <small>OPENING INFO</small>

          <strong>
            ${
              place.opening.known
                ? escapeHTML(place.opening.text)
                : "Not available"
            }
          </strong>

        </div>


        <div class="detail-box">

          <small>PHONE</small>

          <strong>
            ${
              place.phone
                ? escapeHTML(place.phone)
                : "Not listed"
            }
          </strong>

        </div>


        <div class="detail-box">

          <small>WEBSITE</small>

          <strong>
            ${website}
          </strong>

        </div>


        <div class="detail-box">

          <small>MAP COORDINATES</small>

          <strong>
            ${place.lat.toFixed(5)},
            ${place.lon.toFixed(5)}
          </strong>

        </div>

      </div>


      <div class="detail-buttons">

        <button
          class="primary-btn"
          id="detailDirections"
        >
          OPEN DIRECTIONS
        </button>

        <button
          class="secondary-btn"
          id="detailSave"
        >
          ${
            isFavourite(place.id)
              ? "★ SAVED"
              : "☆ SAVE"
          }
        </button>

      </div>

    </div>

  `;


  elements.placeModal.classList.add("show");


  $("detailDirections")
    .addEventListener(
      "click",
      () => openDirections(place)
    );


  $("detailSave")
    .addEventListener(
      "click",
      () => {

        toggleFavourite(place);

        openPlace(place);

      }
    );

}


function closeModal(id) {

  const modal = $(id);

  if (modal) {
    modal.classList.remove("show");
  }

}


document.querySelectorAll("[data-close]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {
        closeModal(
          button.dataset.close
        );
      }
    );

  });


document.querySelectorAll(".modal")
  .forEach(modal => {

    modal.addEventListener(
      "click",
      event => {

        if (event.target === modal) {
          modal.classList.remove("show");
        }

      }
    );

  });


/* =========================================================
   DIRECTIONS
   ========================================================= */

function openDirections(place) {

  if (!state.userLocation) {
    locateUser();
    return;
  }


  const {
    lat,
    lon
  } = state.userLocation;


  const url =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${lat},${lon}` +
    `&destination=${place.lat},${place.lon}`;


  window.open(
    url,
    "_blank",
    "noopener"
  );

}


/* =========================================================
   FAVOURITES
   ========================================================= */

function isFavourite(id) {

  return state.favourites.some(
    place => place.id === id
  );

}


function toggleFavourite(place) {

  const index =
    state.favourites.findIndex(
      item => item.id === place.id
    );


  if (index >= 0) {

    state.favourites.splice(
      index,
      1
    );

  } else {

    state.favourites.push(place);

  }


  localStorage.setItem(
    "nexora_favourites",
    JSON.stringify(
      state.favourites
    )
  );


  renderResults();
  renderFavourites();

}


function renderFavourites() {

  const list =
    elements.favouritesList;


  if (!state.favourites.length) {

    list.innerHTML = `

      <div class="empty-state">

        <div class="empty-icon">★</div>

        <h3>No favourites yet</h3>

        <p>
          Search for a place and press SAVE.
        </p>

      </div>

    `;

    return;

  }


  list.innerHTML =
    state.favourites.map(
      place => `

        <div class="helper-card">

          <h3>
            ${escapeHTML(place.name)}
          </h3>

          <div class="helper-service">
            ${escapeHTML(place.category)}
          </div>

          <p>
            📍 ${escapeHTML(place.address)}
          </p>

          <div class="card-buttons">

            <button
              data-fav-open="${escapeHTML(place.id)}"
            >
              VIEW
            </button>

            <button
              data-fav-remove="${escapeHTML(place.id)}"
            >
              REMOVE
            </button>

          </div>

        </div>

      `
    ).join("");


  list.querySelectorAll(
    "[data-fav-open]"
  ).forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const place =
          state.favourites.find(
            item =>
              item.id ===
              button.dataset.favOpen
          );

        if (place) {

          showPage("explore");

          focusPlace(place);

          openPlace(place);

        }

      }
    );

  });


  list.querySelectorAll(
    "[data-fav-remove]"
  ).forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const index =
          state.favourites.findIndex(
            item =>
              item.id ===
              button.dataset.favRemove
          );

        if (index >= 0) {

          state.favourites.splice(
            index,
            1
          );

          localStorage.setItem(
            "nexora_favourites",
            JSON.stringify(
              state.favourites
            )
          );

          renderFavourites();
          renderResults();

        }

      }
    );

  });

}


/* =========================================================
   HELPERS
   ========================================================= */

$("addHelperBtn")
  .addEventListener(
    "click",
    () => {

      elements.helperForm.reset();

      elements.helperModal.classList.add(
        "show"
      );

    }
  );


elements.helperForm
  .addEventListener(
    "submit",
    event => {

      event.preventDefault();


      const helper = {

        id:
          Date.now().toString(),

        name:
          $("helperName").value.trim(),

        service:
          $("helperService").value.trim(),

        phone:
          $("helperPhone").value.trim(),

        area:
          $("helperArea").value.trim(),

        notes:
          $("helperNotes").value.trim()

      };


      state.helpers.push(
        helper
      );


      localStorage.setItem(
        "nexora_helpers",
        JSON.stringify(
          state.helpers
        )
      );


      closeModal(
        "helperModal"
      );


      renderHelpers();

    }
  );


function renderHelpers() {

  const query =
    ($("helperSearch").value || "")
      .toLowerCase()
      .trim();


  const helpers =
    state.helpers.filter(
      helper =>
        !query ||
        `${helper.name} ${helper.service} ${helper.area}`
          .toLowerCase()
          .includes(query)
    );


  if (!helpers.length) {

    elements.helpersList.innerHTML = `

      <div class="empty-state">

        <div class="empty-icon">♙</div>

        <h3>
          ${
            state.helpers.length
              ? "No matching helpers"
              : "No helpers saved"
          }
        </h3>

        <p>
          Add trusted plumbers, electricians,
          mechanics or other useful contacts.
        </p>

      </div>

    `;

    return;

  }


  elements.helpersList.innerHTML =
    helpers.map(
      helper => `

        <div class="helper-card">

          <h3>
            ${escapeHTML(helper.name)}
          </h3>

          <div class="helper-service">
            ${escapeHTML(helper.service || "Helper")}
          </div>

          <p>
            📍 ${escapeHTML(helper.area || "Area not added")}
          </p>

          ${
            helper.phone
              ? `<p>☎ ${escapeHTML(helper.phone)}</p>`
              : ""
          }

          ${
            helper.notes
              ? `<p>📝 ${escapeHTML(helper.notes)}</p>`
              : ""
          }

          <div class="card-buttons">

            ${
              helper.phone
                ? `
                  <button
                    onclick="window.location.href='tel:${encodeURIComponent(helper.phone)}'"
                  >
                    CALL
                  </button>
                `
                : ""
            }

            <button
              data-helper-delete="${escapeHTML(helper.id)}"
            >
              DELETE
            </button>

          </div>

        </div>

      `
    ).join("");


  elements.helpersList
    .querySelectorAll(
      "[data-helper-delete]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          state.helpers =
            state.helpers.filter(
              helper =>
                helper.id !==
                button.dataset.helperDelete
            );


          localStorage.setItem(
            "nexora_helpers",
            JSON.stringify(
              state.helpers
            )
          );


          renderHelpers();

        }
      );

    });

}


$("helperSearch")
  .addEventListener(
    "input",
    renderHelpers
  );


/* =========================================================
   SEARCH CONTROLS
   ========================================================= */

$("searchBtn")
  .addEventListener(
    "click",
    searchPlaces
  );


$("locateBtn")
  .addEventListener(
    "click",
    locateUser
  );


$("mapLocateBtn")
  .addEventListener(
    "click",
    () => {

      if (!state.userLocation) {
        locateUser();
        return;
      }

      state.map.setView(
        [
          state.userLocation.lat,
          state.userLocation.lon
        ],
        16,
        { animate: true }
      );

    }
  );


$("topLocateBtn")
  .addEventListener(
    "click",
    () => {

      showPage("explore");

      locateUser();

    }
  );


$("emptyLocateBtn")
  .addEventListener(
    "click",
    locateUser
  );


$("clearSearch")
  .addEventListener(
    "click",
    () => {

      elements.searchInput.value = "";

      state.places = [];

      clearPlaceMarkers();

      renderResults();

      elements.searchStatus.textContent =
        "Ready to search";

    }
  );


elements.searchInput
  .addEventListener(
    "keydown",
    event => {

      if (event.key === "Enter") {
        searchPlaces();
      }

    }
  );


document
  .querySelectorAll("[data-search]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        elements.searchInput.value =
          button.dataset.search;

        searchPlaces();

      }
    );

  });


document
  .querySelectorAll("[data-category]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        showPage("explore");

        elements.searchInput.value =
          button.dataset.category;

        if (!state.userLocation) {

          locateUser();

        } else {

          searchPlaces();

        }

      }
    );

  });


/* =========================================================
   LOADING
   ========================================================= */

function showLoading(text) {

  elements.loadingText.textContent =
    text;

  elements.loadingScreen.classList.add(
    "show"
  );

}


function hideLoading() {

  elements.loadingScreen.classList.remove(
    "show"
  );

}


/* =========================================================
   SECURITY / HTML HELPERS
   ========================================================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function safeURL(url) {

  try {

    const parsed =
      new URL(url);

    if (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    ) {
      return parsed.href;
    }

  } catch (_) {}

  return "#";

}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    initMap();

    renderHelpers();

    renderFavourites();

    /*
      We don't automatically request location on page load.
      The user intentionally presses LOCATE.
    */

  }
);
