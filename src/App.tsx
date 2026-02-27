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
  ChevronDown,
  X,
  Settings,
  FolderPlus,
  Trash2,
  Plus,
  Folder
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface Photo {
  id: number;
  latitude: number | null;
  longitude: number | null;
  timestamp: string | null;
  thumbnail_path: string;
  filename: string;
  path: string;
}

interface Stats {
  total: number;
  mapped: number;
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
  const [stats, setStats] = useState<Stats>({ total: 0, mapped: 0 });
  const [loading, setLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState<{ 
    isScanning: boolean, 
    lastScanTime: string | null,
    currentScanTotal: number,
    currentScanProcessed: number
  }>({ 
    isScanning: false, 
    lastScanTime: null,
    currentScanTotal: 0,
    currentScanProcessed: 0
  });
  const [config, setConfig] = useState<{ photosDirectories: string[] }>({ photosDirectories: [] });
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newDirectory, setNewDirectory] = useState('');

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch('/api/photos/mapped');
      const data = await res.json();
      setPhotos(data);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
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
    fetchStats();
    fetchScanStatus();
    fetchConfig();
    
    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      fetchPhotos();
      fetchStats();
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

  const handleAddDirectory = async () => {
    if (!newDirectory.trim()) return;
    const updatedDirs = [...config.photosDirectories, newDirectory.trim()];
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photosDirectories: updatedDirs }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setNewDirectory('');
      }
    } catch (err) {
      console.error('Failed to add directory:', err);
    }
  };

  const handleRemoveDirectory = async (dirToRemove: string) => {
    const updatedDirs = config.photosDirectories.filter(d => d !== dirToRemove);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photosDirectories: updatedDirs }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to remove directory:', err);
    }
  };

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
                <div className="text-2xl font-bold">{stats.total}</div>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Mapped</div>
                <div className="text-2xl font-bold text-emerald-500">{stats.mapped}</div>
              </div>
            </div>

            {/* Mapping Progress Bar */}
            {stats.total > 0 && (
              <div className="space-y-2 px-1">
                <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                  <span>Mapping Coverage</span>
                  <span className="text-emerald-500">{Math.round((stats.mapped / stats.total) * 100)}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/30">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.mapped / stats.total) * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                  />
                </div>
              </div>
            )}

            {/* Scan Progress Bar (Only show when scanning) */}
            {scanStatus.isScanning && scanStatus.currentScanTotal > 0 && (
              <div className="space-y-2 px-1">
                <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                  <span>Scan Progress</span>
                  <span className="text-blue-400">{Math.round((scanStatus.currentScanProcessed / scanStatus.currentScanTotal) * 100)}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/30">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(scanStatus.currentScanProcessed / scanStatus.currentScanTotal) * 100}%` }}
                    transition={{ duration: 0.5, ease: "linear" }}
                    className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                  />
                </div>
                <div className="text-[9px] text-zinc-600 text-right italic">
                  {scanStatus.currentScanProcessed} / {scanStatus.currentScanTotal} files
                </div>
              </div>
            )}

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

            {/* Settings / Directories */}
            <div className="pt-4 border-t border-zinc-800/50">
              <button 
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="w-full flex items-center justify-between group py-2"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider group-hover:text-zinc-200 transition-colors">Scan Directories</h3>
                </div>
                {settingsOpen ? (
                  <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
                )}
              </button>

              <AnimatePresence>
                {settingsOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-4 pt-2"
                  >
                    <div className="space-y-2">
                      {config.photosDirectories.map((dir, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-zinc-800/30 rounded-lg border border-zinc-700/30 group">
                          <div className="flex items-center gap-2 min-w-0">
                            <Folder className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                            <span className="text-[11px] text-zinc-400 truncate">{dir}</span>
                          </div>
                          <button 
                            onClick={() => handleRemoveDirectory(dir)}
                            className="p-1 hover:bg-red-500/10 rounded text-zinc-600 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <FolderPlus className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                        <input 
                          type="text" 
                          value={newDirectory}
                          onChange={(e) => setNewDirectory(e.target.value)}
                          placeholder="e.g. /app/photos_external"
                          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-emerald-500/50 transition-colors"
                          onKeyDown={(e) => e.key === 'Enter' && handleAddDirectory()}
                        />
                      </div>
                      <button 
                        onClick={handleAddDirectory}
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-600 italic px-1">
                      Note: Use absolute paths or paths relative to the app root.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
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
            {photos.map(photo => (
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
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-2xl px-4"
            >
              <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl p-5 shadow-2xl flex gap-6 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 blur-[100px] pointer-events-none" />
                
                <div className="w-40 h-40 rounded-xl overflow-hidden flex-shrink-0 border border-zinc-700/50 shadow-inner bg-zinc-800">
                  <img 
                    src={`/api/thumbnails/${selectedPhoto.thumbnail_path}`} 
                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                    alt={selectedPhoto.filename}
                  />
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                  <div className="flex items-start justify-between mb-2">
                    <h2 className="text-xl font-bold truncate text-white tracking-tight">{selectedPhoto.filename}</h2>
                    <button 
                      onClick={() => setSelectedPhoto(null)}
                      className="p-1.5 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 text-zinc-400 text-xs">
                      <div className="p-1 bg-zinc-800 rounded-md">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                      </div>
                      <span className="font-mono">{selectedPhoto.latitude?.toFixed(6)}, {selectedPhoto.longitude?.toFixed(6)}</span>
                    </div>

                    <div className="flex items-center gap-2.5 text-zinc-400 text-xs">
                      <div className="p-1 bg-zinc-800 rounded-md">
                        <Info className="w-3.5 h-3.5 text-blue-400" />
                      </div>
                      <span>{selectedPhoto.timestamp ? new Date(selectedPhoto.timestamp).toLocaleString() : 'No date info'}</span>
                    </div>

                    <div className="flex items-start gap-2.5 text-zinc-500 text-[10px] mt-3 pt-3 border-t border-zinc-800/50">
                      <div className="p-1 bg-zinc-800/50 rounded-md mt-0.5">
                        <Folder className="w-3 h-3 text-zinc-600" />
                      </div>
                      <div className="flex-1 break-all leading-relaxed">
                        <span className="text-zinc-600 uppercase font-bold mr-1">Path:</span>
                        {selectedPhoto.path}
                      </div>
                    </div>
                  </div>
                </div>
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
