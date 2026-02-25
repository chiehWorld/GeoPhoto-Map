import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { 
  Camera, 
  Map as MapIcon, 
  Image as ImageIcon, 
  RefreshCw, 
  Maximize2, 
  Info,
  MapPin,
  ChevronRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface Photo {
  id: number;
  path: string;
  filename: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: string | null;
  has_gps: number;
  thumbnail_path: string;
}

// Custom Icons
const createClusterCustomIcon = (cluster: any) => {
  const markers = cluster.getAllChildMarkers();
  const firstMarker = markers[0].options.icon.options.html;
  // Extract image src from the marker html
  const srcMatch = firstMarker.match(/src="([^"]+)"/);
  const src = srcMatch ? srcMatch[1] : '';

  return L.divIcon({
    html: `
      <div class="custom-cluster-icon" style="width: 50px; height: 50px;">
        <img src="${src}" class="cluster-img" />
        <div class="cluster-count">${markers.length}</div>
      </div>
    `,
    className: 'custom-marker-cluster',
    iconSize: L.point(50, 50, true),
  });
};

const createPhotoIcon = (thumbUrl: string) => {
  return L.divIcon({
    html: `
      <div class="photo-marker" style="width: 40px; height: 40px;">
        <img src="${thumbUrl}" />
      </div>
    `,
    className: 'custom-photo-marker',
    iconSize: L.point(40, 40, true),
  });
};


export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState<{ isScanning: boolean, lastScanTime: string | null }>({ isScanning: false, lastScanTime: null });
  const [config, setConfig] = useState<{ photosDirectories: string[] }>({ photosDirectories: [] });
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch('/api/photos');
      const data = await res.json();
      setPhotos(data);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
    }
  }, []);

  const fetchScanStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/scan-status');
      const data = await res.json();
      setScanStatus(data);
    } catch (err) {
      console.error('Failed to fetch scan status:', err);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
    fetchScanStatus();
    fetchConfig();
    
    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      fetchPhotos();
      fetchScanStatus();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchPhotos, fetchScanStatus, fetchConfig]);

  const handleScan = async () => {
    try {
      await fetch('/api/scan', { method: 'POST' });
      fetchScanStatus();
    } catch (err) {
      console.error('Scan trigger failed:', err);
    }
  };

  const photosWithGps = photos.filter(p => p.has_gps === 1 && p.latitude !== null && p.longitude !== null);

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? 320 : 0 }}
        className="relative flex-shrink-0 bg-zinc-900 border-r border-zinc-800 overflow-hidden z-20"
      >
        <div className="w-[320px] h-full flex flex-col p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Camera className="w-6 h-6 text-emerald-500" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">GeoPhoto Map</h1>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-zinc-800 rounded-md transition-colors"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>

          <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Total</div>
                <div className="text-2xl font-bold">{photos.length}</div>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Mapped</div>
                <div className="text-2xl font-bold text-emerald-500">{photosWithGps.length}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button 
                onClick={handleScan}
                disabled={scanStatus.isScanning}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-semibold transition-all shadow-lg shadow-emerald-900/20"
              >
                <RefreshCw className={`w-4 h-4 ${scanStatus.isScanning ? 'animate-spin' : ''}`} />
                {scanStatus.isScanning ? 'Scanning...' : 'Manual Refresh'}
              </button>
              {scanStatus.lastScanTime && (
                <p className="text-[10px] text-zinc-500 text-center">
                  Last auto-scan: {new Date(scanStatus.lastScanTime).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Toggle Sidebar Button (when closed) */}
      {!sidebarOpen && (
        <button 
          onClick={() => setSidebarOpen(true)}
          className="absolute top-6 left-6 z-30 p-3 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl hover:bg-zinc-800 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Main Map Area */}
      <main className="flex-1 relative">
        <MapContainer 
          center={[20, 0]} 
          zoom={3} 
          className="w-full h-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          <MarkerClusterGroup
            chunkedLoading
            iconCreateFunction={createClusterCustomIcon}
            maxClusterRadius={60}
            showCoverageOnHover={false}
          >
            {photosWithGps.map(photo => (
              <Marker 
                key={photo.id} 
                position={[photo.latitude!, photo.longitude!]}
                icon={createPhotoIcon(`/api/thumbnails/${photo.thumbnail_path}`)}
                eventHandlers={{
                  click: () => setSelectedPhoto(photo)
                }}
              >
                <Popup className="photo-popup">
                  <div className="p-1">
                    <img 
                      src={`/api/thumbnails/${photo.thumbnail_path}`} 
                      className="w-48 h-32 object-cover rounded-lg mb-2"
                    />
                    <div className="text-xs font-bold text-zinc-900 truncate">{photo.filename}</div>
                    <div className="text-[10px] text-zinc-500">{new Date(photo.timestamp || '').toLocaleDateString()}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>

        {/* Floating UI Elements */}
        <AnimatePresence>
          {selectedPhoto && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-md px-4"
            >
              <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 shadow-2xl flex gap-4">
                <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 border border-zinc-700">
                  <img 
                    src={`/api/photos-raw/${selectedPhoto.id}`} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h2 className="text-lg font-bold truncate">{selectedPhoto.filename}</h2>
                  <div className="flex items-center gap-2 text-zinc-400 text-xs mt-1">
                    <MapPin className="w-3 h-3" />
                    <span>{selectedPhoto.latitude?.toFixed(4)}, {selectedPhoto.longitude?.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500 text-[10px] mt-1">
                    <Info className="w-3 h-3" />
                    <span>{selectedPhoto.timestamp ? new Date(selectedPhoto.timestamp).toLocaleString() : 'No date info'}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPhoto(null)}
                  className="self-start p-1 hover:bg-zinc-800 rounded-lg"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }
        .leaflet-popup-content-wrapper {
          background: white;
          border-radius: 12px;
          padding: 0;
          overflow: hidden;
        }
        .leaflet-popup-content {
          margin: 0;
        }
        .leaflet-popup-tip {
          background: white;
        }
      `}</style>
    </div>
  );
}
