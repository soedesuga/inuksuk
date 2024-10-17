// Set API
var platform = new H.service.Platform({
  apikey: '20wVBIlsykQAt-LUrBerv8Lys3SKXB2WEiyefne5_yc',
});

// Japanese map style
var omvService = platform.getOMVService({ path: 'v2/vectortiles/core/mc' });
var baseUrl = 'https://js.api.here.com/v3/3.1/styles/omv/oslo/japan/';
var style = new H.map.Style(`${baseUrl}normal.day.yaml`, baseUrl);

// Set provider and layer
var omvProvider = new H.service.omv.Provider(omvService, style);
var omvlayer = new H.map.layer.TileLayer(omvProvider, { max: 22 });

//Start async function
async function run_process(){

//Get coordinate
let posHere = await new Promise((resolve, reject) => {
  navigator.geolocation.getCurrentPosition(resolve, reject);
});
let latHere = posHere.coords.latitude;
let lngHere = posHere.coords.longitude;

//Show map
var map = new H.Map(document.getElementById('mapContainer'), omvlayer, {
  zoom: 17,
  center: { lat: latHere, lng: lngHere},
});

// Create the default UI
const ui = H.ui.UI.createDefault(map, omvlayer);

//Add map behavior(resizing)
window.addEventListener('resize', () => map.getViewPort().resize());
var behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

let isEdited = false;
document.getElementById("from-search").addEventListener("click", function(){
  isEdited = true;
});

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

let turnLat = [];
let turnLng = [];
let sectionLat = [];
let sectionLng = [];

document.getElementById("searchButton").addEventListener("click", async function(){
  try{
    map.removeObjects(map.getObjects());
  }catch{};
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
let latThere = getDestination.lat;
let lngThere = getDestination.lng;
//Routing
let routingParameters = {
  'transportMode': 'pedestrian',
  // The start point of the route:
  'origin': latHere + "," + lngHere,
  // The end point of the route:
  'destination': latThere + "," + lngThere,
  // Include the route shape in the response
  'return': 'polyline,actions,instructions',
  'lang':'ja-jp'
};
let routeLine;

// Define a callback function to process the routing response:
const onResult = function(result) {
  // Ensure that at least one route was found
  if (result.routes.length) {
      const lineStrings = [];
      
      result.routes[0].sections.forEach((section) => {
          // Create a linestring to use as a point source for the route line
          lineStrings.push(H.geo.LineString.fromFlexiblePolyline(section.polyline));
          H.geo.LineString.fromFlexiblePolyline(section.polyline).getLatLngAltArray();
          let actions = section.actions;
          // Add a marker for each maneuver
          let poly = H.geo.LineString.fromFlexiblePolyline(section.polyline).getLatLngAltArray();
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
          let instTable = document.getElementById("instructions");
        
          //xの行を記述するため、1から9の数字を繰り返しHTMLに記述する
          section.actions.forEach((action) => {
            let tr = document.createElement('tr');
            let td = document.createElement('td');
            td.textContent = action.instruction;
            tr.appendChild(td);
            instTable.appendChild(tr);
          });
        
      });

      // Create an instance of H.geo.MultiLineString
      const multiLineString = new H.geo.MultiLineString(lineStrings);

      if (routeLine) {
        // If the routePolyline we just set the new geometry
        routeLine.setGeometry(multiLineString);
    } else {
        // routePolyline is not yet defined, instantiate a new H.map.Polyline
        routeLine = new H.map.Polyline(multiLineString, {
            style: {
                lineWidth: 5
            }
        });
    }


//Dragable object for test
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
 * Listen to the dragstart and store the relevant position information of the marker
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
          routingParameters.origin = `${coords.lat},${coords.lng}`;
      } else if (markerId === 'B') {
          routingParameters.destination = `${coords.lat},${coords.lng}`;
      }

      updateRoute();
  }
}, false);

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
console.log(originMarker);
console.log(destinationMarker);


      // Create a H.map.Group to hold all the map objects and enable us to obtain 
      // the bounding box that contains all its objects within
      const group = new H.map.Group();
      group.addObject(routeLine);
      
      // Add the group to the map
      map.addObject(group);
      // Set the map viewport to make the entire route visible:
      map.getViewModel().setLookAtData({
          bounds: group.getBoundingBox()
      });
      
  };
};

// Get an instance of the routing service version 8:
const router = platform.getRoutingService(null, 8);

// Call the calculateRoute() method with the routing parameters,
// the callback, and an error callback function (called if a
// communication error occurs):
function updateRoute() {
  router.calculateRoute(routingParameters, onResult,
    function(error) {
        alert(error.message);
    }
  );
};

updateRoute();
});
//searchButton above

console.log(turnLat);
console.log(turnLng);
console.log(map);
//End async
return;
};
run_process();

element = document.getElementById("instructions");
        while (element.firstChild) {
          element.removeChild(element.firstChild);
        }