/* =========================================================
   NEXORA LOCAL INTELLIGENCE
   REAL OpenStreetMap + Overpass Search
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
   SAFE EVENT HELPER
   ========================================================= */

function on(id, event, callback) {
  const el = $(id);

  if (el) {
    el.addEventListener(event, callback);
  }
}


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

  if (elements.pageTitle) {
    elements.pageTitle.textContent =
      titles[page] || titles.home;
  }

  if (page === "explore") {
    setTimeout(() => {
      if (state.map) {
        state.map.invalidateSize();
      }
    }, 200);
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


on("startExploreBtn", "click", () => {

  showPage("explore");

  if (!state.userLocation) {
    locateUser();
  }

});


on("heroLocateBtn", "click", () => {

  showPage("explore");
  locateUser();

});


/* =========================================================
   MAP
   ========================================================= */

function initMap() {

  if (!document.getElementById("map")) {
    console.error("NEXORA: #map element not found.");
    return;
  }

  state.map = L.map("map", {
    zoomControl: true,
    attributionControl: true
  }).setView(
    [20.5937, 78.9629],
    5
  );


  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        "&copy; OpenStreetMap contributors"
    }
  ).addTo(state.map);

}


/* =========================================================
   ICONS
   ========================================================= */

function createUserIcon() {

  return L.divIcon({
    className: "",
    html: `
      <div class="user-location-marker"></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

}


function createPlaceIcon(number = "") {

  return L.divIcon({
    className: "",
    html: `
      <div class="place-marker">
        ${number}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
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


  if (elements.topLocationText) {
    elements.topLocationText.textContent =
      "Locating...";
  }


  navigator.geolocation.getCurrentPosition(

    position => {

      const lat =
        position.coords.latitude;

      const lon =
        position.coords.longitude;

      const accuracy =
        position.coords.accuracy || 50;


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


      if (elements.topLocationText) {
        elements.topLocationText.textContent =
          `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }


      if (
        elements.explorePage &&
        !elements.explorePage.classList.contains("active")
      ) {
        showPage("explore");
      }

    },

    error => {

      console.error(
        "NEXORA location error:",
        error
      );


      let message =
        "Location could not be found.";


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


      setStatus(
        message,
        "error"
      );


      if (elements.topLocationText) {
        elements.topLocationText.textContent =
          "Locate me";
      }

    },

    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 30000
    }

  );

}


/* =========================================================
   SHOW USER LOCATION
   ========================================================= */

function updateUserLocationOnMap() {

  if (
    !state.map ||
    !state.userLocation
  ) {
    return;
  }


  const {
    lat,
    lon,
    accuracy
  } = state.userLocation;


  if (state.userMarker) {
    state.map.removeLayer(
      state.userMarker
    );
  }


  if (state.accuracyCircle) {
    state.map.removeLayer(
      state.accuracyCircle
    );
  }


  state.userMarker =
    L.marker(
      [lat, lon],
      {
        icon: createUserIcon(),
        zIndexOffset: 2000
      }
    )
    .addTo(state.map)
    .bindPopup(`
      <div class="popup-title">
        YOU ARE HERE
      </div>

      <div class="popup-info">
        Your current location
      </div>
    `);


  state.accuracyCircle =
    L.circle(
      [lat, lon],
      {
        radius: accuracy,
        color: "#54f39a",
        fillOpacity: 0.04,
        weight: 1
      }
    )
    .addTo(state.map);


  state.map.setView(
    [lat, lon],
    15,
    {
      animate: true
    }
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


  if (elements.sideLocation) {
    elements.sideLocation.textContent =
      short;
  }

}


/* =========================================================
   STATUS
   ========================================================= */

function setStatus(
  message,
  type = ""
) {

  if (elements.mapStatus) {
    elements.mapStatus.textContent =
      message;
  }


  if (elements.statusDot) {

    elements.statusDot.className =
      "status-dot";


    if (type === "ready") {
      elements.statusDot.classList.add(
        "ready"
      );
    }


    if (type === "error") {
      elements.statusDot.classList.add(
        "error"
      );
    }

  }

}


/* =========================================================
   SEARCH ALIASES
   ========================================================= */

const SEARCH_PROFILES = {

  pharmacy: {
    label: "Pharmacy",
    queries: [
      `nwr["amenity"="pharmacy"]`,
      `nwr["shop"="chemist"]`,
      `nwr["healthcare"="pharmacy"]`,
      `nwr["name"~"pharmacy|chemist|medical|medicine",i]`
    ]
  },


  plumber: {
    label: "Plumber",
    queries: [
      `nwr["craft"="plumber"]`,
      `nwr["service"~"plumb",i]`,
      `nwr["name"~"plumber|plumbing",i]`
    ]
  },


  electrician: {
    label: "Electrician",
    queries: [
      `nwr["craft"="electrician"]`,
      `nwr["service"~"electric",i]`,
      `nwr["name"~"electrician|electrical",i]`
    ]
  },


  mechanic: {
    label: "Mechanic",
    queries: [
      `nwr["shop"="car_repair"]`,
      `nwr["shop"="motorcycle_repair"]`,
      `nwr["craft"="mechanic"]`,
      `nwr["service"~"repair|mechanic|auto",i]`,
      `nwr["name"~"mechanic|auto repair|car repair|garage",i]`
    ]
  },


  grocery: {
    label: "Grocery",
    queries: [
      `nwr["shop"="supermarket"]`,
      `nwr["shop"="convenience"]`,
      `nwr["shop"="grocery"]`,
      `nwr["shop"="greengrocer"]`,
      `nwr["name"~"grocery|supermarket|mart",i]`
    ]
  },


  restaurant: {
    label: "Restaurant",
    queries: [
      `nwr["amenity"="restaurant"]`,
      `nwr["amenity"="fast_food"]`,
      `nwr["amenity"="cafe"]`,
      `nwr["name"~"restaurant|cafe|food",i]`
    ]
  },


  hardware: {
    label: "Hardware",
    queries: [
      `nwr["shop"="hardware"]`,
      `nwr["name"~"hardware",i]`
    ]
  },


  hospital: {
    label: "Hospital",
    queries: [
      `nwr["amenity"="hospital"]`,
      `nwr["healthcare"="hospital"]`,
      `nwr["name"~"hospital",i]`
    ]
  },


  hotel: {
    label: "Hotel",
    queries: [
      `nwr["tourism"="hotel"]`,
      `nwr["tourism"="guest_house"]`,
      `nwr["name"~"hotel|inn",i]`
    ]
  },


  bank: {
    label: "Bank",
    queries: [
      `nwr["amenity"="bank"]`,
      `nwr["name"~"bank",i]`
    ]
  },


  petrol: {
    label: "Petrol Station",
    queries: [
      `nwr["amenity"="fuel"]`,
      `nwr["name"~"petrol|fuel|gas",i]`
    ]
  },


  school: {
    label: "School",
    queries: [
      `nwr["amenity"="school"]`,
      `nwr["name"~"school",i]`
    ]
  }

};


/* =========================================================
   NORMALIZE SEARCH
   ========================================================= */

function normalizeSearch(text) {

  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

}


/* =========================================================
   BUILD OVERPASS QUERY
   ========================================================= */

function buildOverpassQuery(
  searchText,
  radius
) {

  if (!state.userLocation) {
    throw new Error(
      "Location required."
    );
  }


  const {
    lat,
    lon
  } = state.userLocation;


  const search =
    normalizeSearch(searchText);


  /*
    EVERYTHING
  */

  if (
    !search ||
    search === "everything" ||
    search === "all" ||
    search === "nearby"
  ) {

    return `
[out:json][timeout:35];

(
  nwr["name"](around:${radius},${lat},${lon});
  nwr["shop"](around:${radius},${lat},${lon});
  nwr["amenity"](around:${radius},${lat},${lon});
  nwr["craft"](around:${radius},${lat},${lon});
  nwr["healthcare"](around:${radius},${lat},${lon});
  nwr["tourism"](around:${radius},${lat},${lon});
);

out center tags;
`;

  }


  /*
    KNOWN CATEGORY
  */

  if (SEARCH_PROFILES[search]) {

    const queries =
      SEARCH_PROFILES[search]
        .queries
        .map(q =>
          `${q}(around:${radius},${lat},${lon});`
        )
        .join("\n");


    return `
[out:json][timeout:35];

(
${queries}
);

out center tags;
`;

  }


  /*
    CUSTOM SEARCH
  */

  const terms =
    search
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 5);


  const regex =
    terms
      .map(escapeRegex)
      .join("|");


  return `
[out:json][timeout:35];

(
  nwr["name"~"${regex}",i"](around:${radius},${lat},${lon});
  nwr["shop"~"${regex}",i"](around:${radius},${lat},${lon});
  nwr["amenity"~"${regex}",i"](around:${radius},${lat},${lon});
  nwr["craft"~"${regex}",i"](around:${radius},${lat},${lon});
  nwr["healthcare"~"${regex}",i"](around:${radius},${lat},${lon});
  nwr["tourism"~"${regex}",i"](around:${radius},${lat},${lon});
  nwr["office"~"${regex}",i"](around:${radius},${lat},${lon});
);

out center tags;
`;

}


/* =========================================================
   OVERPASS SEARCH
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
    elements.searchInput?.value.trim() || "";


  /*
    Your HTML distance filter is in KM.
    Convert it to METERS for Overpass.
  */

  let radiusKm =
    Number(
      elements.distanceFilter?.value || 5
    );


  if (!Number.isFinite(radiusKm)) {
    radiusKm = 5;
  }


  const radiusMeters =
    Math.round(
      radiusKm * 1000
    );


  const minRating =
    Number(
      elements.ratingFilter?.value || 0
    );


  const availability =
    elements.availabilityFilter?.value ||
    "any";


  showLoading(
    `Finding ${searchText || "places"} nearby...`
  );


  if (elements.searchStatus) {
    elements.searchStatus.textContent =
      "Searching real OpenStreetMap data...";
  }


  try {

    if (state.searchController) {
      state.searchController.abort();
    }


    state.searchController =
      new AbortController();


    const query =
      buildOverpassQuery(
        searchText,
        radiusMeters
      );


    /*
      Public Overpass servers.
      If one is busy, try the next.
    */

    const endpoints = [

      "https://overpass-api.de/api/interpreter",

      "https://overpass.kumi.systems/api/interpreter",

      "https://overpass.private.coffee/api/interpreter"

    ];


    let data = null;
    let lastError = null;


    for (
      const endpoint of endpoints
    ) {

      try {

        if (elements.searchStatus) {
          elements.searchStatus.textContent =
            "Connecting to map data...";
        }


        const response =
          await fetch(
            endpoint,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "text/plain;charset=UTF-8"
              },
              body: query,
              signal:
                state.searchController.signal
            }
          );


        if (!response.ok) {

          throw new Error(
            `Server returned HTTP ${response.status}`
          );

        }


        const json =
          await response.json();


        if (
          json &&
          Array.isArray(json.elements)
        ) {

          data = json;

          break;

        }


      } catch (error) {

        lastError = error;

        console.warn(
          "Overpass endpoint failed:",
          endpoint,
          error
        );

      }

    }


    if (!data) {

      throw (
        lastError ||
        new Error(
          "All map servers failed."
        )
      );

    }


    let places =
      parsePlaces(
        data.elements || []
      );


    /*
      Rating filter:
      Only filter out a place if an actual rating exists
      and is below the selected rating.

      This prevents the whole result list disappearing
      just because OSM has no rating.
    */

    if (minRating > 0) {

      places =
        places.filter(place => {

          if (place.rating === null) {
            return true;
          }

          return (
            place.rating >= minRating
          );

        });

    }


    places =
      applyAvailabilityFilter(
        places,
        availability
      );


    /*
      Relevance first for category searches,
      distance second.
    */

    const normalizedSearch =
      normalizeSearch(searchText);


    places.sort((a, b) => {

      const aScore =
        getRelevanceScore(
          a,
          normalizedSearch
        );


      const bScore =
        getRelevanceScore(
          b,
          normalizedSearch
        );


      if (bScore !== aScore) {
        return bScore - aScore;
      }


      return (
        a.distance -
        b.distance
      );

    });


    state.places =
      places;


    renderMapMarkers();

    renderResults();


    if (elements.searchStatus) {

      elements.searchStatus.textContent =
        places.length
          ? `${places.length} real places found`
          : "No matching places found";

    }


    setStatus(
      places.length
        ? `${places.length} places found nearby`
        : "No places found in this area",
      places.length
        ? "ready"
        : ""
    );


  } catch (error) {

    if (
      error.name === "AbortError"
    ) {
      return;
    }


    console.error(
      "NEXORA SEARCH ERROR:",
      error
    );


    state.places = [];

    clearPlaceMarkers();

    renderResults();


    if (elements.searchStatus) {
      elements.searchStatus.textContent =
        "Map search failed. Please try again.";
    }


    setStatus(
      "Map data server is temporarily unavailable.",
      "error"
    );

  } finally {

    hideLoading();

  }

}


/* =========================================================
   RELEVANCE
   ========================================================= */

function getRelevanceScore(
  place,
  search
) {

  if (!search) {
    return 0;
  }


  let score = 0;


  const name =
    place.name.toLowerCase();


  const category =
    place.category.toLowerCase();


  if (name === search) {
    score += 100;
  }


  if (
    name.includes(search)
  ) {
    score += 60;
  }


  if (
    category.includes(search)
  ) {
    score += 50;
  }


  if (
    place.searchText.includes(search)
  ) {
    score += 30;
  }


  return score;

}


/* =========================================================
   PARSE OSM
   ========================================================= */

function parsePlaces(
  elementsArray
) {

  const seen = new Set();

  const places = [];


  for (
    const element
    of elementsArray
  ) {

    const tags =
      element.tags || {};


    const lat =
      Number(
        element.lat ??
        element.center?.lat
      );


    const lon =
      Number(
        element.lon ??
        element.center?.lon
      );


    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      continue;
    }


    const name =
      tags.name ||
      tags["name:en"] ||
      tags["name:hi"] ||
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
      tags["phone:mobile"] ||
      "";


    const website =
      tags.website ||
      tags["contact:website"] ||
      "";


    const searchText =
      [
        name,
        tags.shop,
        tags.amenity,
        tags.craft,
        tags.healthcare,
        tags.tourism,
        tags.service
      ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();


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

      searchText,

      tags

    });

  }


  return places;

}


/* =========================================================
   CATEGORY
   ========================================================= */

function getCategory(tags) {

  if (tags.craft) {
    return prettify(
      tags.craft
    );
  }


  if (tags.amenity) {
    return prettify(
      tags.amenity
    );
  }


  if (tags.shop) {
    return prettify(
      tags.shop
    );
  }


  if (tags.healthcare) {
    return prettify(
      tags.healthcare
    );
  }


  if (tags.tourism) {
    return prettify(
      tags.tourism
    );
  }


  if (tags.office) {
    return prettify(
      tags.office
    );
  }


  return "Place";

}


function prettify(value) {

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, c =>
      c.toUpperCase()
    );

}


/* =========================================================
   RATING
   ========================================================= */

function getRating(tags) {

  const values = [

    tags.rating,

    tags.stars,

    tags["contact:rating"],

    tags["survey:rating"]

  ];


  for (
    const value
    of values
  ) {

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

  if (
    filter === "any" ||
    !filter
  ) {

    return places;

  }


  if (
    filter === "known"
  ) {

    return places.filter(
      place =>
        place.opening.known
    );

  }


  if (
    filter === "open"
  ) {

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


/* =========================================================
   BASIC OPENING HOURS CHECK
   ========================================================= */

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

    tags["addr:neighbourhood"],

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
    toRadians(
      lat2 - lat1
    );


  const dLon =
    toRadians(
      lon2 - lon1
    );


  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(
      toRadians(lat1)
    ) *
    Math.cos(
      toRadians(lat2)
    ) *
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

  return (
    value *
    Math.PI /
    180
  );

}


function formatDistance(km) {

  if (km < 1) {

    return `${
      Math.round(km * 1000)
    } m`;

  }


  return `${km.toFixed(1)} km`;

}


/* =========================================================
   MAP MARKERS
   ========================================================= */

function clearPlaceMarkers() {

  if (!state.map) {
    return;
  }


  state.placeMarkers.forEach(
    marker => {

      try {
        state.map.removeLayer(
          marker
        );
      } catch (_) {}

    }
  );


  state.placeMarkers = [];

}


function renderMapMarkers() {

  if (!state.map) {
    return;
  }


  clearPlaceMarkers();


  state.places.forEach(
    (place, index) => {

      const marker =
        L.marker(
          [
            place.lat,
            place.lon
          ],
          {
            icon:
              createPlaceIcon(
                index + 1
              )
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

    }
  );


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
        padding: [35, 35],
        maxZoom: 16
      }
    );

  }


  if (elements.mapPlaceCount) {

    elements.mapPlaceCount.textContent =
      `${state.places.length} places`;

  }

}


/* =========================================================
   POPUP
   ========================================================= */

function createPopup(place) {

  return `

    <div class="popup-title">
      ${escapeHTML(place.name)}
    </div>

    <div class="popup-info">

      ${escapeHTML(place.category)}

      <br>

      📍 ${formatDistance(
        place.distance
      )}

      ${
        place.rating !== null
          ? `
            <br>
            ⭐ ${place.rating.toFixed(1)} / 5
          `
          : `
            <br>
            ⭐ Rating unavailable
          `
      }

      <br>

      ${
        place.opening.known
          ? "🕐 Hours listed"
          : "🕐 Hours unavailable"
      }

    </div>

  `;

}


/* =========================================================
   RESULTS
   ========================================================= */

function renderResults() {

  if (!elements.resultsList) {
    return;
  }


  const places =
    state.places;


  if (elements.resultCount) {

    elements.resultCount.textContent =
      `${places.length} ${
        places.length === 1
          ? "place"
          : "places"
      }`;

  }


  if (!places.length) {

    elements.resultsList.innerHTML = `

      <div class="empty-state">

        <div class="empty-icon">
          ⌕
        </div>

        <h3>
          No places found
        </h3>

        <p>
          Try another search or increase
          the distance.
        </p>

        <button
          class="primary-btn"
          id="emptyLocateBtn2"
        >
          USE MY LOCATION
        </button>

      </div>

    `;


    on(
      "emptyLocateBtn2",
      "click",
      locateUser
    );


    return;

  }


  elements.resultsList.innerHTML =
    places
      .map(
        place =>
          createResultCard(place)
      )
      .join("");


  elements.resultsList
    .querySelectorAll(
      "[data-place-id]"
    )
    .forEach(card => {

      card.addEventListener(
        "click",
        event => {

          if (
            event.target.closest(
              "button"
            )
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
    .querySelectorAll(
      "[data-action]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();


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


          if (
            action === "details"
          ) {
            openPlace(place);
          }


          if (
            action === "directions"
          ) {
            openDirections(place);
          }


          if (
            action === "save"
          ) {
            toggleFavourite(place);
          }

        }
      );

    });

}


/* =========================================================
   RESULT CARD
   ========================================================= */

function createResultCard(
  place
) {

  const saved =
    isFavourite(
      place.id
    );


  const ratingHTML =
    place.rating !== null
      ? `
        <span class="rating">
          ★ ${place.rating.toFixed(1)}
        </span>
      `
      : `
        <span>
          ★ No rating data
        </span>
      `;


  const openingHTML =
    place.opening.known
      ? `
        <span class="open">
          🕐 Hours listed
        </span>
      `
      : `
        <span>
          🕐 Hours unavailable
        </span>
      `;


  return `

    <article
      class="result-card"
      data-place-id="${escapeHTML(
        place.id
      )}"
    >

      <div class="result-top">

        <div>

          <div class="result-name">
            ${escapeHTML(
              place.name
            )}
          </div>

          <div class="result-type">
            ${escapeHTML(
              place.category
            )}
          </div>

        </div>

        <div class="result-distance">
          ${formatDistance(
            place.distance
          )}
        </div>

      </div>


      <div class="result-meta">

        ${ratingHTML}

        &nbsp; • &nbsp;

        ${openingHTML}

        <br>

        📍 ${
          escapeHTML(
            place.address
          )
        }

      </div>


      <div class="result-actions">

        <button
          data-action="details"
          data-place-id="${escapeHTML(
            place.id
          )}"
        >
          DETAILS
        </button>

        <button
          data-action="directions"
          data-place-id="${escapeHTML(
            place.id
          )}"
        >
          DIRECTIONS
        </button>

        <button
          data-action="save"
          data-place-id="${escapeHTML(
            place.id
          )}"
        >
          ${
            saved
              ? "★ SAVED"
              : "☆ SAVE"
          }
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
      [
        place.lat,
        place.lon
      ],
      17,
      {
        animate: true
      }
    );

  }


  const marker =
    state.placeMarkers.find(
      item => {

        const position =
          item.getLatLng();


        return (
          Math.abs(
            position.lat -
            place.lat
          ) < 0.000001 &&

          Math.abs(
            position.lng -
            place.lon
          ) < 0.000001
        );

      }
    );


  if (marker) {
    marker.openPopup();
  }


  highlightResult(
    place.id
  );

}


function highlightResult(
  id
) {

  document
    .querySelectorAll(
      ".result-card"
    )
    .forEach(card => {

      card.classList.toggle(
        "selected",
        card.dataset.placeId ===
          id
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
          href="${safeURL(
            place.website
          )}"
          target="_blank"
          rel="noopener"
        >
          Open Website
        </a>
      `
      : "Not listed";


  const phone =
    place.phone
      ? `
        <a
          href="tel:${encodeURIComponent(
            place.phone
          )}"
        >
          ${escapeHTML(
            place.phone
          )}
        </a>
      `
      : "Not listed";


  elements.placeDetails.innerHTML = `

    <div class="place-detail">

      <small>
        ${escapeHTML(
          place.category
        )}
      </small>

      <h2>
        ${escapeHTML(
          place.name
        )}
      </h2>

      <div class="place-address">
        📍 ${escapeHTML(
          place.address
        )}
      </div>


      <div class="detail-grid">

        <div class="detail-box">

          <small>
            DISTANCE
          </small>

          <strong>
            ${formatDistance(
              place.distance
            )}
          </strong>

        </div>


        <div class="detail-box">

          <small>
            RATING
          </small>

          <strong>
            ${
              place.rating !== null
                ? `⭐ ${place.rating.toFixed(1)} / 5`
                : "Not available"
            }
          </strong>

        </div>


        <div class="detail-box">

          <small>
            OPENING INFO
          </small>

          <strong>
            ${
              place.opening.known
                ? escapeHTML(
                    place.opening.text
                  )
                : "Not available"
            }
          </strong>

        </div>


        <div class="detail-box">

          <small>
            PHONE
          </small>

          <strong>
            ${phone}
          </strong>

        </div>


        <div class="detail-box">

          <small>
            WEBSITE
          </small>

          <strong>
            ${website}
          </strong>

        </div>


        <div class="detail-box">

          <small>
            MAP COORDINATES
          </small>

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


  elements.placeModal.classList.add(
    "show"
  );


  on(
    "detailDirections",
    "click",
    () => {
      openDirections(place);
    }
  );


  on(
    "detailSave",
    "click",
    () => {

      toggleFavourite(place);

      openPlace(place);

    }
  );

}


/* =========================================================
   MODALS
   ========================================================= */

function closeModal(id) {

  const modal =
    $(id);


  if (modal) {
    modal.classList.remove(
      "show"
    );
  }

}


document
  .querySelectorAll(
    "[data-close]"
  )
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


document
  .querySelectorAll(
    ".modal"
  )
  .forEach(modal => {

    modal.addEventListener(
      "click",
      event => {

        if (
          event.target === modal
        ) {

          modal.classList.remove(
            "show"
          );

        }

      }
    );

  });


/* =========================================================
   DIRECTIONS
   ========================================================= */

function openDirections(
  place
) {

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
    "_blank"
  );

}


/* =========================================================
   FAVOURITES
   ========================================================= */

function isFavourite(id) {

  return state.favourites.some(
    place =>
      place.id === id
  );

}


function toggleFavourite(
  place
) {

  const index =
    state.favourites.findIndex(
      item =>
        item.id ===
        place.id
    );


  if (index >= 0) {

    state.favourites.splice(
      index,
      1
    );

  } else {

    state.favourites.push(
      place
    );

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

  if (!elements.favouritesList) {
    return;
  }


  const list =
    elements.favouritesList;


  if (!state.favourites.length) {

    list.innerHTML = `

      <div class="empty-state">

        <div class="empty-icon">
          ★
        </div>

        <h3>
          No favourites yet
        </h3>

        <p>
          Search for a place and press SAVE.
        </p>

      </div>

    `;

    return;

  }


  list.innerHTML =
    state.favourites
      .map(
        place => `

          <div class="helper-card">

            <h3>
              ${escapeHTML(
                place.name
              )}
            </h3>

            <div class="helper-service">
              ${escapeHTML(
                place.category
              )}
            </div>

            <p>
              📍 ${escapeHTML(
                place.address
              )}
            </p>

            <div class="card-buttons">

              <button
                data-fav-open="${escapeHTML(
                  place.id
                )}"
              >
                VIEW
              </button>

              <button
                data-fav-remove="${escapeHTML(
                  place.id
                )}"
              >
                REMOVE
              </button>

            </div>

          </div>

        `
      )
      .join("");


  list
    .querySelectorAll(
      "[data-fav-open]"
    )
    .forEach(button => {

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

            showPage(
              "explore"
            );

            focusPlace(
              place
            );

            openPlace(
              place
            );

          }

        }
      );

    });


  list
    .querySelectorAll(
      "[data-fav-remove]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          state.favourites =
            state.favourites.filter(
              item =>
                item.id !==
                button.dataset.favRemove
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
      );

    });

}


/* =========================================================
   HELPERS
   ========================================================= */

on(
  "addHelperBtn",
  "click",
  () => {

    if (elements.helperForm) {
      elements.helperForm.reset();
    }


    if (elements.helperModal) {

      elements.helperModal.classList.add(
        "show"
      );

    }

  }
);


if (elements.helperForm) {

  elements.helperForm.addEventListener(
    "submit",
    event => {

      event.preventDefault();


      const helper = {

        id:
          Date.now().toString(),

        name:
          $("helperName")?.value.trim() || "",

        service:
          $("helperService")?.value.trim() || "",

        phone:
          $("helperPhone")?.value.trim() || "",

        area:
          $("helperArea")?.value.trim() || "",

        notes:
          $("helperNotes")?.value.trim() || ""

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

}


function renderHelpers() {

  if (!elements.helpersList) {
    return;
  }


  const query =
    (
      $("helperSearch")?.value ||
      ""
    )
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

        <div class="empty-icon">
          ♙
        </div>

        <h3>
          ${
            state.helpers.length
              ? "No matching helpers"
              : "No helpers saved"
          }
        </h3>

        <p>
          Add trusted plumbers,
          electricians, mechanics
          or other contacts.
        </p>

      </div>

    `;

    return;

  }


  elements.helpersList.innerHTML =
    helpers
      .map(
        helper => `

          <div class="helper-card">

            <h3>
              ${escapeHTML(
                helper.name
              )}
            </h3>

            <div class="helper-service">
              ${escapeHTML(
                helper.service ||
                "Helper"
              )}
            </div>

            <p>
              📍 ${escapeHTML(
                helper.area ||
                "Area not added"
              )}
            </p>

            ${
              helper.phone
                ? `
                  <p>
                    ☎ ${escapeHTML(
                      helper.phone
                    )}
                  </p>
                `
                : ""
            }

            ${
              helper.notes
                ? `
                  <p>
                    📝 ${escapeHTML(
                      helper.notes
                    )}
                  </p>
                `
                : ""
            }

            <div class="card-buttons">

              ${
                helper.phone
                  ? `
                    <button
                      onclick="window.location.href='tel:${encodeURIComponent(
                        helper.phone
                      )}'"
                    >
                      CALL
                    </button>
                  `
                  : ""
              }

              <button
                data-helper-delete="${escapeHTML(
                  helper.id
                )}"
              >
                DELETE
              </button>

            </div>

          </div>

        `
      )
      .join("");


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


on(
  "helperSearch",
  "input",
  renderHelpers
);


/* =========================================================
   SEARCH CONTROLS
   ========================================================= */

on(
  "searchBtn",
  "click",
  searchPlaces
);


on(
  "locateBtn",
  "click",
  locateUser
);


on(
  "mapLocateBtn",
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
      {
        animate: true
      }
    );

  }
);


on(
  "topLocateBtn",
  "click",
  () => {

    showPage(
      "explore"
    );

    locateUser();

  }
);


on(
  "emptyLocateBtn",
  "click",
  locateUser
);


on(
  "clearSearch",
  "click",
  () => {

    if (elements.searchInput) {
      elements.searchInput.value = "";
    }


    state.places = [];


    clearPlaceMarkers();

    renderResults();


    if (elements.searchStatus) {
      elements.searchStatus.textContent =
        "Ready to search";
    }

  }
);


/* =========================================================
   ENTER TO SEARCH
   ========================================================= */

if (elements.searchInput) {

  elements.searchInput.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter"
      ) {

        event.preventDefault();

        searchPlaces();

      }

    }
  );

}


/* =========================================================
   SEARCH SUGGESTIONS
   ========================================================= */

document
  .querySelectorAll(
    "[data-search]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        if (elements.searchInput) {

          elements.searchInput.value =
            button.dataset.search;

        }


        search
