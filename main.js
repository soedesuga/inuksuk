//Start async function
async function run_process(){

//BOILERPLATE CODE TO INITIALIZE THE MAP
const platform = new H.service.Platform({
    'apikey': '20wVBIlsykQAt-LUrBerv8Lys3SKXB2WEiyefne5_yc'
});

// Japanese map style
var omvService = platform.getOMVService({ path: 'v2/vectortiles/core/mc' });
var baseUrl = 'https://js.api.here.com/v3/3.1/styles/omv/oslo/japan/';
var style = new H.map.Style(`${baseUrl}normal.day.yaml`, baseUrl);

// Set provider and layer
var omvProvider = new H.service.omv.Provider(omvService, style);
var omvlayer = new H.map.layer.TileLayer(omvProvider, { max: 22 });

//Get coordinate
let posHere = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
let latHere = posHere.coords.latitude;
let lngHere = posHere.coords.longitude;
let latThere;
let lngThere;

// Instantiate (and display) a map:
map = new H.Map(
    document.getElementById("mapContainer"),
    omvlayer, {
        zoom: 15,
        center: {
            lat: latHere,
            lng: lngHere
        }
    });

let isEdited = false;
document.getElementById("from-search").addEventListener("click", function(){
  isEdited = true;
});
document.getElementById("to-search").addEventListener("click", function(){
    map.addEventListener('tap', function(ev) {
        const target = ev.target;
        const pointer = ev.currentPointer;
        const coords = map.screenToGeo(pointer.viewportX, pointer.viewportY);
        console.log(map.screenToGeo(pointer.viewportX, pointer.viewportY));
    });
}, {once: true});

//Use geocoording
var service = platform.getSearchService();

//Auto complete the origin
service.reverseGeocode({
  at: latHere + "," + lngHere
}, (result) => {
  result.items.forEach((item) => {
    document.getElementById("from-search").value = item.address.label;
  });
}, alert);

// MapEvents enables the event system
// Behavior implements default interactions for pan/zoom (also on mobile touch environments)
const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

// Disable zoom on double-tap to allow removing waypoints on double-tap
behavior.disable(H.mapevents.Behavior.Feature.DBL_TAP_ZOOM);

window.addEventListener('resize', () => map.getViewPort().resize());

// Create the default UI:
var ui = H.ui.UI.createDefault(map, omvlayer);

// ROUTING LOGIC STARTS HERE

// This variable holds the instance of the route polyline
let routePolyline;

document.getElementById("searchButton").addEventListener("click", async function(){
try{
    map.removeObjects(map.getObjects());
}catch{};

function resetTable(){
    const ele = document.getElementById("instructions");
    const clone = ele.cloneNode( false ); 
    ele.parentNode.replaceChild( clone , ele ); 
    console.log(ele);
    console.log("reset");
}
/**
 * Handler for the H.service.RoutingService8#calculateRoute call
 *
 * @param {object} response The response object returned by calculateRoute method
 */
function routeResponseHandler(response) {
    let instTable = document.getElementById("instructions");
    const sections = response.routes[0].sections;
    const lineStrings = [];
    sections.forEach((section) => {
        // convert Flexible Polyline encoded string to geometry
        lineStrings.push(H.geo.LineString.fromFlexiblePolyline(section.polyline));
        let actions = section.actions;
        // Add a marker for each maneuver
        let poly = H.geo.LineString.fromFlexiblePolyline(section.polyline).getLatLngAltArray();

        let turnLat = [];
        let turnLng = [];
        let sectionLat = [];
        let sectionLng = [];
        for (i = 0; i < actions.length; i += 1) {
          let action = actions[i];
          let bAction = actions[Math.max(i-1,0)];
          turnLat.push(poly[action.offset * 3]);
          let lats = [];
          for (j = bAction.offset; j <= action.offset *3 ; j += 3){
            lats.push(poly[j * 3]);
          };
          sectionLat.push(lats);
          turnLng.push(poly[action.offset * 3 + 1]);
          let lngs = [];
          for (j = bAction.offset; j <= action.offset *3 ; j += 3){
            lngs.push(poly[j * 3 + 1]);
          };
          sectionLng.push(lngs);
        };
        sectionLat.shift();
        sectionLng.shift();
        console.log(sectionLat);
        console.log(sectionLng);
        if (!document.getElementById("instructions").hasChildNodes()){
        section.actions.forEach((action) => {
          let tr = document.createElement('tr');
          let td = document.createElement('td');
          td.textContent = action.instruction;
          tr.appendChild(td);
          instTable.appendChild(tr);
        });
        document.getElementById("navi").style.pointerEvents = "all";
        }
    });
    const multiLineString = new H.geo.MultiLineString(lineStrings);
    const bounds = multiLineString.getBoundingBox();

    // Create the polyline for the route
    if (routePolyline) {
        // If the routePolyline we just set has the new geometry
        routePolyline.setGeometry(multiLineString);
    } else {
        // If routePolyline is not yet defined, instantiate a new H.map.Polyline
        routePolyline = new H.map.Polyline(multiLineString, {
            style: {
                lineWidth: 5
            }
        });
    }

    // Add the polyline to the map
    map.addObject(routePolyline);
}

/**
 * Returns an instance of H.map.Icon to style the markers
 * @param {number|string} id An identifier that will be displayed as marker label
 *
 * @return {H.map.Icon}
 */
function getMarkerIcon(id) {
    const svgCircle = `<svg width="30" height="30" version="1.1" xmlns="http://www.w3.org/2000/svg">
  <g id="marker">
    <circle cx="15" cy="15" r="10" fill="#0099D8" stroke="#0099D8" stroke-width="4" />
    <text x="50%" y="50%" text-anchor="middle" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="12px" dy=".3em">${id}</text>
  </g></svg>`;
    return new H.map.Icon(svgCircle, {
        anchor: {
            x: 10,
            y: 10
        }
    });
}

/**
 * Create an instance of H.map.Marker and add it to the map
 *
 * @param {object} position  An object with 'lat' and 'lng' properties defining the position of the marker
 * @param {string|number} id An identifier that will be displayed as marker label
 * @return {H.map.Marker} The instance of the marker that was created
 */
function addMarker(position, id) {
    const marker = new H.map.Marker(position, {
        data: {
            id
        },
        icon: getMarkerIcon(id),
        // Enable smooth dragging
        volatility: true
    });

    // Enable draggable markers
    marker.draggable = true;

    map.addObject(marker);
    return marker;
}

/**
 * This method calls the routing service to retrieve the route line geometry
 */
function updateRoute() {
    routingParams.via = new H.service.Url.MultiValueQueryParameter(
        waypoints.map(wp => `${wp.getGeometry().lat},${wp.getGeometry().lng}`));
    resetTable();
    document.getElementById("navi").style.pointerEvents = "none";
    // Call the routing service with the defined parameters
    router.calculateRoute(routingParams, routeResponseHandler, console.error);
}

//Get origin
let getOrigin = await new Promise((resolve, reject) => {
    service.geocode(
      {
          q: document.getElementById("from-search").value,
      },
      (result) => {
          result.items.forEach((item) => {
            resolve(item.position);
          });
      },
      alert
  );
  });
  let getDestination = await new Promise((resolve, reject) => {
  //Get destination
  service.geocode(
    {
        q: document.getElementById("to-search").value,
    },
    (result) => {
        // マーカーを追加
        result.items.forEach((item) => {
          resolve(item.position);
        });
    },
    alert
  );
  });
  if(isEdited){
    latHere = getOrigin.lat;
    lngHere = getOrigin.lng;
  };
  latThere = getDestination.lat;
  lngThere = getDestination.lng;

// ADD MARKERS FOR ORIGIN/DESTINATION
const origin = {
    lat: latHere,
    lng: lngHere
};
const destination = {
    lat: latThere,
    lng: lngThere
};

const originMarker = addMarker(origin, 'A');
const destinationMarker = addMarker(destination, 'B');

// CALCULATE THE ROUTE BETWEEN THE TWO WAYPOINTS
// This array holds instances of H.map.Marker representing the route waypoints
const waypoints = []

// Define the routing service parameters
const routingParams = {
    // defines multiple waypoints
    'via': new H.service.Url.MultiValueQueryParameter(waypoints),
    'transportMode': 'pedestrian',
    // The start point of the route:
    'origin': latHere + "," + lngHere,
    // The end point of the route:
    'destination': latThere + "," + lngThere,
    // Include the route shape in the response
    'return': 'polyline,actions,instructions',
    'lang':'ja-jp'
};

// Get an instance of the H.service.RoutingService8 service
const router = platform.getRoutingService(null, 8);

// Call the routing service with the defined parameters and display the route
updateRoute();

/**
 * Listen to the dragstart and store relevant position information of the marker
 */
map.addEventListener('dragstart', function(ev) {
    const target = ev.target;
    const pointer = ev.currentPointer;
    if (target instanceof H.map.Marker) {
        // Disable the default draggability of the underlying map
        behavior.disable(H.mapevents.Behavior.Feature.PANNING);

        var targetPosition = map.geoToScreen(target.getGeometry());
        // Calculate the offset between mouse and target's position
        // when starting to drag a marker object
        target['offset'] = new H.math.Point(
            pointer.viewportX - targetPosition.x, pointer.viewportY - targetPosition.y);
    }
}, false);

/**
 * Listen to the dragend and update the route
 */
map.addEventListener('dragend', function(ev) {
    const target = ev.target;
    if (target instanceof H.map.Marker) {
        // re-enable the default draggability of the underlying map
        // when dragging has completed
        behavior.enable(H.mapevents.Behavior.Feature.PANNING);
        const coords = target.getGeometry();
        const markerId = target.getData().id;

        // Update the routing params `origin` and `destination` properties
        // in case we dragging either the origin or the destination marker
        if (markerId === 'A') {
            routingParams.origin = `${coords.lat},${coords.lng}`;
        } else if (markerId === 'B') {
            routingParams.destination = `${coords.lat},${coords.lng}`;
        }

        updateRoute();
    }
}, false);

/**
 * Listen to the drag event and move the position of the marker as necessary
 */
map.addEventListener('drag', function(ev) {
    const target = ev.target;
    const pointer = ev.currentPointer;
    if (target instanceof H.map.Marker) {
        target.setGeometry(
            map.screenToGeo(pointer.viewportX - target['offset'].x, pointer.viewportY - target['offset'].y)
        );
    }
}, false);

/**
 * Listen to the tap event to add a new waypoint
 */
map.addEventListener('tap', function(ev) {
    const target = ev.target;
    const pointer = ev.currentPointer;
    const coords = map.screenToGeo(pointer.viewportX, pointer.viewportY);

    if (!(target instanceof H.map.Marker)) {
        const marker = addMarker(coords, waypoints.length + 1);
        waypoints.push(marker);
        updateRoute();
    }
});

/**
 * Listen to the dbltap event to remove a waypoint
 */
map.addEventListener('dbltap', function(ev) {
    const target = ev.target;

    if (target instanceof H.map.Marker) {
        // Prevent origin or destination markers from being removed
        if (['origin', 'destination'].indexOf(target.getData().id) !== -1) {
            return;
        }

        const markerIdx = waypoints.indexOf(target);
        if (markerIdx !== -1) {
            // Remove the marker from the array of way points
            waypoints.splice(markerIdx, 1)
            // Iterate over the remaining waypoints and update their data
            waypoints.forEach((marker, idx) => {
                const id = idx + 1;
                // Update marker's id
                marker.setData({
                    id
                });
                // Update marker's icon to show its new id
                marker.setIcon(getMarkerIcon(id))
            });
        }

        // Remove the marker from the map
        map.removeObject(target);

        updateRoute();
    }
});
});

document.getElementById("navi").addEventListener("click", function(){
if (document.getElementById("instructions").hasChildNodes()){
    console.log("startnavi");
};
});
//End async
return;
};
run_process();