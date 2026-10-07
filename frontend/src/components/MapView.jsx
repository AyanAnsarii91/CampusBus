import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const busIcon = L.divIcon({
  className: "bus-marker",
  html: '<div style="width:38px;height:38px;border-radius:14px;background:#0f172a;color:white;display:grid;place-items:center;border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,.25);font-size:19px">🚌</div>',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});
const stopIcon = L.divIcon({
  className: "stop-marker",
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.2)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function MapView({
  location,
  stops = [],
  route = [],
  selectedStopId,
}) {
  const points = route.length
    ? route.map((s) => [s.latitude, s.longitude])
    : stops.map((s) => [s.latitude, s.longitude]);
  const center = location
    ? [location.latitude, location.longitude]
    : points[0] || [22.7196, 75.8577];
  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.length > 1 && (
        <Polyline
          positions={points}
          pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.75 }}
        />
      )}
      {stops.map((s) => (
        <Marker
          key={s._id || s.sequence}
          position={[s.latitude, s.longitude]}
          icon={stopIcon}
        >
          <Popup>
            <strong>{s.name}</strong>
            <br />
            Stop {s.sequence}
          </Popup>
        </Marker>
      ))}
      {selectedStopId &&
        stops
          .filter((s) => s._id === selectedStopId)
          .map((s) => (
            <CircleMarker
              key={"selected" + s._id}
              center={[s.latitude, s.longitude]}
              radius={18}
              pathOptions={{ color: "#16a34a", weight: 3, fillOpacity: 0.08 }}
            />
          ))}
      {location?.latitude != null && (
        <Marker
          position={[location.latitude, location.longitude]}
          icon={busIcon}
        >
          <Popup>
            <strong>Live Bus</strong>
            <br />
            {Math.round(location.speed || 0)} km/h
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
