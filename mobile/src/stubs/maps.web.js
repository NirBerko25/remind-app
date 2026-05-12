// Web map: vanilla Leaflet (CDN) with an imperatively-created container div.
// React never reconciles the Leaflet-owned div, eliminating reconciliation crashes.
import React, {
  createContext, useContext, useEffect, useRef, useState, forwardRef, useImperativeHandle,
} from 'react';
import { View } from 'react-native';

// ── CDN loader ────────────────────────────────────────────────────────────────
let _leafletPromise = null;
function loadLeaflet() {
  if (_leafletPromise) return _leafletPromise;
  _leafletPromise = new Promise(resolve => {
    if (typeof window === 'undefined') return resolve(null);
    if (window.L) return resolve(window.L);

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      const L = window.L;
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      resolve(L);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return _leafletPromise;
}

function deltaToZoom(d) {
  return Math.max(2, Math.min(19, Math.round(Math.log2(180 / d))));
}

const MapCtx = createContext(null);

// ── MapView ───────────────────────────────────────────────────────────────────
const MapView = forwardRef(function MapView(
  { style, region, onPress, onRegionChangeComplete, showsUserLocation, children },
  ref,
) {
  // parentRef → the React-managed View. Leaflet div is appended into it as a child.
  const parentRef   = useRef(null);
  const leafletDiv  = useRef(null); // Leaflet owns this div — React never touches it
  const mapObj      = useRef(null);
  const [ready, setReady] = useState(false);

  // Boot Leaflet once after mount
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(L => {
      if (cancelled || !L || !parentRef.current) return;

      // Create and append the map div imperatively so React never reconciles it
      const div = document.createElement('div');
      div.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;';
      parentRef.current.appendChild(div);
      leafletDiv.current = div;

      const center = region ? [region.latitude, region.longitude] : [32.0853, 34.7818];
      const zoom   = region ? deltaToZoom(region.latitudeDelta) : 13;

      const map = L.map(div, { center, zoom });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
      }).addTo(map);

      map.on('click', e => {
        onPress?.({
          nativeEvent: { coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng } },
        });
      });
      map.on('moveend', () => {
        const c = map.getCenter(), b = map.getBounds();
        onRegionChangeComplete?.({
          latitude: c.lat, longitude: c.lng,
          latitudeDelta: b.getNorth() - b.getSouth(),
          longitudeDelta: b.getEast() - b.getWest(),
        });
      });

      if (showsUserLocation) {
        navigator.geolocation?.getCurrentPosition(pos => {
          L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
            radius: 8, fillColor: '#4F6EF7', color: '#fff', weight: 2, fillOpacity: 1,
          }).addTo(map);
        });
      }

      mapObj.current = map;
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
      mapObj.current?.remove();
      mapObj.current = null;
      leafletDiv.current?.remove();
      leafletDiv.current = null;
      setReady(false);
    };
  }, []);

  // Resize map when React View dimensions change
  const handleLayout = e => {
    const { width, height } = e.nativeEvent.layout;
    if (leafletDiv.current) {
      leafletDiv.current.style.width  = `${width}px`;
      leafletDiv.current.style.height = `${height}px`;
    }
    mapObj.current?.invalidateSize();
  };

  // Fly-to for address search
  useImperativeHandle(ref, () => ({
    animateToRegion(r, ms = 600) {
      mapObj.current?.flyTo(
        [r.latitude, r.longitude],
        deltaToZoom(r.latitudeDelta),
        { duration: ms / 1000 },
      );
    },
  }));

  return (
    // position:relative so the absolute Leaflet div is contained within
    <View ref={parentRef} style={[style, { position: 'relative', overflow: 'hidden' }]} onLayout={handleLayout}>
      {ready && (
        <MapCtx.Provider value={{ map: mapObj.current, L: window.L }}>
          {/* Children render null in the DOM; they add Leaflet layers via effects */}
          {children}
        </MapCtx.Provider>
      )}
    </View>
  );
});

// ── Layer hook ────────────────────────────────────────────────────────────────
function useLeafletLayer(factory, deps) {
  const ctx = useContext(MapCtx);
  const layerRef = useRef(null);
  useEffect(() => {
    if (!ctx?.map || !ctx?.L) return;
    layerRef.current?.remove();
    layerRef.current = factory(ctx.map, ctx.L) ?? null;
    return () => { layerRef.current?.remove(); layerRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.map, ...deps]);
  return null;
}

// ── Overlay components ────────────────────────────────────────────────────────

export function Marker({ coordinate, title, pinColor }) {
  return useLeafletLayer((map, L) => {
    if (!coordinate) return;
    const c = pinColor || '#4F6EF7';
    const icon = L.divIcon({
      html: `<div style="width:14px;height:14px;background:${c};border-radius:50%;border:2.5px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4)"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7], className: '',
    });
    return L.marker([coordinate.latitude, coordinate.longitude], { icon, title: title || '' }).addTo(map);
  }, [coordinate?.latitude, coordinate?.longitude, pinColor, title]);
}

export function Circle({ center, radius, fillColor, strokeColor, strokeWidth }) {
  return useLeafletLayer((map, L) => {
    if (!center) return;
    return L.circle([center.latitude, center.longitude], {
      radius: radius || 500,
      fillColor: fillColor || '#4F6EF7',
      fillOpacity: 0.12,
      color: strokeColor || '#4F6EF7',
      weight: strokeWidth ?? 2,
    }).addTo(map);
  }, [center?.latitude, center?.longitude, radius, fillColor, strokeColor, strokeWidth]);
}

export function Polygon({ coordinates, fillColor, strokeColor, strokeWidth }) {
  return useLeafletLayer((map, L) => {
    if (!coordinates?.length) return;
    return L.polygon(coordinates.map(c => [c.latitude, c.longitude]), {
      fillColor: fillColor || '#4F6EF7',
      fillOpacity: 0.12,
      color: strokeColor || '#4F6EF7',
      weight: strokeWidth ?? 2,
    }).addTo(map);
  }, [JSON.stringify(coordinates), fillColor, strokeColor, strokeWidth]);
}

export function Polyline({ coordinates, strokeColor, strokeWidth }) {
  return useLeafletLayer((map, L) => {
    if (!coordinates?.length) return;
    return L.polyline(coordinates.map(c => [c.latitude, c.longitude]), {
      color: strokeColor || '#10B981',
      weight: strokeWidth ?? 2,
      dashArray: '6 4',
    }).addTo(map);
  }, [JSON.stringify(coordinates), strokeColor, strokeWidth]);
}

export const PROVIDER_GOOGLE = 'google';
export default MapView;
