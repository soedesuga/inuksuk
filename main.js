//Start async function
async function run_process(){

async function sendData(msg){
    try{
        const data = new TextEncoder().encode(msg);
        await characteristic.writeValue(data);
        console.log(msg + 'sent to ESP32');
    }catch{
        console.log("not connected")
        document.getElementById("connect").textContent = "接続";
    }
}

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

//Use geocoording
var service = platform.getSearchService();

document.getElementById("from-search").addEventListener("click", function(){
    map.addEventListener('tap', function(ev) {
        const pointer = ev.currentPointer;
        latThere = map.screenToGeo(pointer.viewportX, pointer.viewportY).lat;
        lngThere = map.screenToGeo(pointer.viewportX, pointer.viewportY).lng;
        service.reverseGeocode({
            at: latThere + "," + lngThere
          }, (result) => {
            result.items.forEach((item) => {
              document.getElementById("from-search").value = item.address.label;
            });
          }, alert);
    }, {once: true});
});

document.getElementById("to-search").addEventListener("click", function(){
    map.addEventListener('tap', function(ev) {
        const pointer = ev.currentPointer;
        latThere = map.screenToGeo(pointer.viewportX, pointer.viewportY).lat;
        lngThere = map.screenToGeo(pointer.viewportX, pointer.viewportY).lng;
        service.reverseGeocode({
            at: latThere + "," + lngThere
          }, (result) => {
            result.items.forEach((item) => {
              document.getElementById("to-search").value = item.address.label;
            });
          }, alert);
    }, {once: true});
});

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

let sectionLat = [];
let sectionLng = [];
let sectionInst = [];
try{
    map.removeObjects(map.getObjects());
}catch{};

function resetTable(){
    const ele = document.getElementById("instructions");
    const clone = ele.cloneNode( false ); 
    ele.parentNode.replaceChild( clone , ele ); 
    console.log("reset");
    sendData("BK");
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
        sectionLat = [];
        sectionLng = [];
        for (i = 0; i < actions.length; i += 1) {
          let action = actions[i];
          let bAction = actions[Math.max(i-1,0)];
          let lats = [];
          for (j = bAction.offset *3; j <= action.offset *3 ; j += 3){
            
            lats.push(poly[j]);
          };
          sectionLat.push(lats);
          let lngs = [];
          for (j = bAction.offset *3; j <= action.offset *3 ; j += 3){
            lngs.push(poly[j + 1]);
          };
          sectionLng.push(lngs);
        };
        sectionLat.shift();
        sectionLng.shift();
        if (!document.getElementById("instructions").hasChildNodes()){
        section.actions.forEach((action) => {
          let tr = document.createElement('tr');
          let td = document.createElement('td');
          td.textContent = action.instruction;
          tr.appendChild(td);
          instTable.appendChild(tr);
        });
        sectionInst = section.actions;
        }
    });
    const multiLineString = new H.geo.MultiLineString(lineStrings);

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

const svgMarkup = `<svg width="30" height="30" version="1.1" xmlns="http://www.w3.org/2000/svg">
<g id="marker">
  <circle cx="15" cy="15" r="15" fill="#0f5bff"/>
</g></svg>`;
const markerN = new H.map.Marker({lat : latHere, lng : lngHere}, {
    icon: new H.map.Icon(svgMarkup,{
        anchor: {
            x: 10,
            y: 10
        }
    }),
    // Enable smooth dragging
    volatility: true
});
const adjustMarker = map.addObject(markerN);
const svgMarkup2 = `<svg width="30" height="30" version="1.1" xmlns="http://www.w3.org/2000/svg">
<g id="marker">
  <circle cx="10" cy="10" r="5" fill="#b3cbff"/>
</g></svg>`;
const markerM = new H.map.Marker({lat : latHere, lng : lngHere}, {
    icon: new H.map.Icon(svgMarkup2,{
        anchor: {
            x: 10,
            y: 10
        }
    }),
    // Enable smooth dragging
    volatility: true
});
const svgMarkup3 = `<svg width="30" height="30" version="1.1" xmlns="http://www.w3.org/2000/svg">
<g id="marker">
  <circle cx="15" cy="15" r="0" fill="#4040ff"/>
</g></svg>`;
const markerO = new H.map.Marker({lat : latHere, lng : lngHere}, {
    icon: new H.map.Icon(svgMarkup3,{
        anchor: {
            x: 10,
            y: 10
        }
    }),
    // Enable smooth dragging
    volatility: true
});
const adjustMarker2 = map.addObject(markerM);
const adjustMarker3 = map.addObject(markerO);
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
        //下の行は仮設置！！！！！！！！！！！！！！！！
        if (markerId != 'O') {
        // Update the routing params `origin` and `destination` properties
        // in case we dragging either the origin or the destination marker
        if (markerId === 'A') {
            routingParams.origin = `${coords.lat},${coords.lng}`;
        } else if (markerId === 'B') {
            routingParams.destination = `${coords.lat},${coords.lng}`;
        }
        updateRoute();
        //下の行は仮設置！！！！！！！！！！！！！！！！
        };
        //ここまで
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


// オプション・パラメータをセット
const position_options = {
    // 高精度を要求する
    enableHighAccuracy: true,
    // 最大待ち時間（ミリ秒）
    timeout: 60000,
    // キャッシュ有効期間（ミリ秒）
    maximumAge: 0
};
// 現在位置情報を取得
navigator.geolocation.watchPosition(monitor, failed, position_options);

function failed(){
    console.log("failed");
}

// 位置情報取得完了時の処理
function monitor(event) {
    console.log("success");
	let getLat = event.coords.latitude;
	let getLng = event.coords.longitude;
    markerO.setGeometry(new H.geo.Point(getLat, getLng));
    let resLat;
    let resLng;
    let corLat;
    let corLng;
    let d;
    let t;
    let indexFromCorner;
    sectionLat.some((lats,indexa) => {
        let lngs = sectionLng[indexa];
        lats.some((lat,indexb) => {
            let polyLat = lat;
            let polyLng = lngs[indexb];
            let poly2Lat = lats[indexb +1];
            let poly2Lng = lngs[indexb +1];
            if (poly2Lat == undefined){
                return true;
            } else {
            t = ((getLat - polyLat) * (poly2Lat - polyLat) + (getLng - polyLng) * (poly2Lng - polyLng)) / ((poly2Lat - polyLat) ** 2 + (poly2Lng - polyLng) ** 2);
            if (t <= 0){
                resLat = polyLat;
                resLng = polyLng;
            }else if(t >= 1){
                resLat = poly2Lat;
                resLng = poly2Lng;
            }else{
            resLat = polyLat + t * (poly2Lat - polyLat);
            resLng = polyLng + t * (poly2Lng - polyLng);
            };
            const R = 111320; //一度あたりの距離
            const deltaLat = resLat - getLat;
            const deltaLng = resLng - getLng;
            const latDistance = deltaLat * R;
            const lngDistance = deltaLng * R * Math.cos(getLat * Math.PI / 180);
            d = Math.sqrt(Math.pow(latDistance, 2) + Math.pow(lngDistance, 2));
            };
            if (d < 10 && t < 1){
                indexFromCorner = indexb + 1;
                return true;
            };
        });
        if (d < 10 && t < 1){
            corLat = lats[lats.length - 1];
            corLng = lngs[lngs.length - 1];
            let table = document.getElementById("instructions");
            Array.prototype.slice.call(table.rows).forEach(row => {
                row.style.color = "#000";
            });
            table.rows[indexa + 1].style.color = "#ff4040";
            console.log(sectionInst[indexa + 1].action);
            console.log(sectionInst[indexa + 1].direction);
            //cornerまでの道のり計算
            let td = 0;
            let index = lats.length - 1;
            while(true){
                const R = 111320; //一度あたりの距離
                const deltaLat = lats[index] - lats[index - 1];
                const deltaLng = lngs[index] - lngs[index - 1];
                const latDistance = deltaLat * R;
                const lngDistance = deltaLng * R * Math.cos(lats[index] * Math.PI / 180);
                const Distance = Math.sqrt(Math.pow(latDistance, 2) + Math.pow(lngDistance, 2))
                if (index > indexFromCorner){
                    td += Distance;
                    index --;
                }else{
                    if (td > 100){
                        td = 101;
                        break;
                    }
                    const exLatDistance = (lats[index] - resLat) * R;
                    const exLngDistance = (lngs[index] - resLng) * R * Math.cos(resLat * Math.PI / 180);
                    const exDistance = Math.sqrt(Math.pow(exLatDistance, 2) + Math.pow(exLngDistance, 2));
                    td += exDistance;
                    break;
                }
            };
            console.log(td);
            let tdRank = 0;
            if(td <= 10){
                tdRank = 3;
            }else if(td > 10 && td <= 50){
                tdRank = 2;
            }else if(td >50 && td <= 100){
                tdRank = 1;
            }else{
                tdRank = 0;
            }
            console.log(tdRank);
            let dataString;
            if (tdRank == 0){
                dataString = "CL";
            }else{
                if(sectionInst[indexa + 1].direction == "right"){
                    dataString = "R" + tdRank;
                }else if(sectionInst[indexa + 1].direction == "left"){
                    dataString = "L" + tdRank;
                }else{
                    dataString = "S" + tdRank;
                };
            };
            if (indexa == 0 && t < 0 && indexFromCorner == 1){
                dataString = "BK";
            };
            sendData(dataString);
            return true;
        };
    });
    if (d < 10){
        markerN.setGeometry(new H.geo.Point(resLat, resLng));
        markerM.setGeometry(new H.geo.Point(corLat, corLng));
    }else{
        markerN.setGeometry(new H.geo.Point(getLat, getLng));
        markerM.setGeometry(new H.geo.Point(getLat, getLng));
        originMarker.setGeometry(new H.geo.Point(getLat, getLng));
        routingParams.origin = `${getLat},${getLng}`;
        updateRoute();
    };

}
//end SearchButton
});

//End async
return;
};
run_process();