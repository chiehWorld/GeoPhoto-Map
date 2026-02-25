import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import exifReader from "exif-reader";
import sharp from "sharp";
import { fileURLToPath } from "url";
import heicConvert from "heic-convert";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(process.env.NODE_ENV === 'production' ? "/app/data/photos.db" : "photos.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE,
    filename TEXT,
    latitude REAL,
    longitude REAL,
    timestamp TEXT,
    has_gps INTEGER DEFAULT 0,
    thumbnail_path TEXT
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Load configuration helper
  const loadConfig = () => {
    const configPath = path.join(__dirname, "config.json");
    let cfg = { photosDirectories: ["./photos"] };
    if (fs.existsSync(configPath)) {
      try {
        cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        // Ensure it's an array for backward compatibility or single string
        if (typeof cfg.photosDirectories === "string") {
          cfg.photosDirectories = [cfg.photosDirectories];
        } else if (!(cfg as any).photosDirectories && (cfg as any).photosDirectory) {
          cfg.photosDirectories = [(cfg as any).photosDirectory];
        }
      } catch (e) {
        console.error("Error reading config.json, using defaults", e);
      }
    }
    return cfg;
  };

  const THUMBS_DIR = path.join(__dirname, "thumbnails");
  if (!fs.existsSync(THUMBS_DIR)) fs.mkdirSync(THUMBS_DIR, { recursive: true });

  // Serve thumbnails
  app.use("/api/thumbnails", express.static(THUMBS_DIR));

  // API: Serve raw photo by ID
  app.get("/api/photos-raw/:id", (req, res) => {
    const photo = db.prepare("SELECT path FROM photos WHERE id = ?").get(req.params.id) as { path: string } | undefined;
    if (photo && fs.existsSync(photo.path)) {
      res.sendFile(photo.path);
    } else {
      res.status(404).send("Not found");
    }
  });

  // API: Get all photos
  app.get("/api/photos", (req, res) => {
    const photos = db.prepare("SELECT * FROM photos").all();
    res.json(photos);
  });

  // API: Get current config
  app.get("/api/config", (req, res) => {
    res.json(loadConfig());
  });

  // Scanning Logic
  let isScanning = false;
  let lastScanTime: string | null = null;

  const getAllFiles = (dirPath: string, arrayOfFiles: string[] = []) => {
    try {
      if (!fs.existsSync(dirPath)) {
        console.error(`Directory does not exist: ${dirPath}`);
        return arrayOfFiles;
      }
      
      const files = fs.readdirSync(dirPath);
      if (files.length === 0) {
        console.warn(`Directory is empty: ${dirPath}`);
      }

      files.forEach((file) => {
        try {
          const fullPath = path.join(dirPath, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
          } else {
            arrayOfFiles.push(fullPath);
          }
        } catch (e) {
          console.warn(`Could not access ${file} in ${dirPath}: ${e.message}`);
        }
      });
    } catch (e) {
      console.error(`Error reading directory ${dirPath}: ${e.message}`);
    }

    return arrayOfFiles;
  };

  const performScan = async () => {
    if (isScanning) return;
    isScanning = true;
    console.log("Starting background scan...");
    
    const currentConfig = loadConfig();
    const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tiff", ".tif", ".bmp"];
    let addedCount = 0;

    try {
      for (const dir of currentConfig.photosDirectories) {
        const PHOTOS_DIR = path.isAbsolute(dir) ? dir : path.join(__dirname, dir);
        if (!fs.existsSync(PHOTOS_DIR)) {
          console.warn(`Skipping non-existent directory: ${PHOTOS_DIR}`);
          continue;
        }

        const allFiles = getAllFiles(PHOTOS_DIR);
        console.log(`Found ${allFiles.length} total files in ${PHOTOS_DIR}`);
        let imageFilesCount = 0;
        for (const filePath of allFiles) {
          try {
            const ext = path.extname(filePath).toLowerCase();
            if (!imageExtensions.includes(ext)) continue;
            imageFilesCount++;

            const file = path.basename(filePath);
            const existing = db.prepare("SELECT id FROM photos WHERE path = ?").get(filePath);
            if (existing) continue;

            let lat = null;
            let lng = null;
            let timestamp = null;
            let hasGps = 0;

            // Use exiftool to extract metadata (extremely robust for HEIC/JPG)
            try {
              const metadataJson = execSync(`exiftool -j -n "${filePath}"`).toString();
              const metadata = JSON.parse(metadataJson)[0];
              
              if (metadata.GPSLatitude !== undefined && metadata.GPSLongitude !== undefined) {
                lat = metadata.GPSLatitude;
                lng = metadata.GPSLongitude;
                hasGps = 1;
              }
              
              if (metadata.DateTimeOriginal) {
                // Format: "2025:02:24 12:34:56" -> ISO
                const t = metadata.DateTimeOriginal.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
                timestamp = new Date(t).toISOString();
              } else if (metadata.CreateDate) {
                const t = metadata.CreateDate.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
                timestamp = new Date(t).toISOString();
              }
            } catch (exifError) {
              console.warn(`Exiftool failed for ${file}: ${exifError.message}`);
            }

            // Try to read file into buffer once
            let fileBuffer: Buffer;
            try {
              fileBuffer = await fs.promises.readFile(filePath);
              if (!fileBuffer || fileBuffer.length === 0) {
                console.error(`Error: File ${file} is empty.`);
                continue;
              }

              // If it's HEIC, convert it to JPEG buffer first
              if (ext === ".heic" || ext === ".heif") {
                try {
                  const outputBuffer = await heicConvert({
                    buffer: fileBuffer,
                    format: 'JPEG',
                    quality: 1
                  });
                  fileBuffer = Buffer.from(outputBuffer);
                } catch (heicError) {
                  console.error(`Error converting HEIC ${file}: ${heicError.message}`);
                  continue;
                }
              }
            } catch (readError) {
              console.error(`Error reading file ${file}: ${readError.message}`);
              continue;
            }

            // Generate thumbnail
            const thumbFilename = `thumb_${Date.now()}_${file}`;
            const thumbPath = path.join(THUMBS_DIR, thumbFilename);
            
            try {
              await sharp(fileBuffer).resize(300, 300, { fit: "cover" }).toFile(thumbPath);
            } catch (e) {
              console.error(`Error: Failed to process image ${file} (possibly unsupported format like HEIC). Error: ${e.message}`);
              continue; // Skip this file if thumbnail generation fails
            }

            db.prepare(`
              INSERT INTO photos (path, filename, latitude, longitude, timestamp, has_gps, thumbnail_path)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(filePath, file, lat, lng, timestamp, hasGps, thumbFilename);
            addedCount++;
          } catch (fileError) {
            console.error(`Unexpected error processing file ${filePath}:`, fileError);
          }
        }
        console.log(`Directory ${PHOTOS_DIR}: Identified ${imageFilesCount} images, added ${addedCount} new ones.`);
      }
      lastScanTime = new Date().toISOString();
      console.log(`Scan complete. Added ${addedCount} photos.`);
    } catch (error) {
      console.error("Scan error:", error);
    } finally {
      isScanning = false;
    }
  };

  // Start background scan every 5 minutes
  setInterval(performScan, 5 * 60 * 1000);
  // Run initial scan on startup
  performScan();

  // API: Get scan status
  app.get("/api/scan-status", (req, res) => {
    res.json({ isScanning, lastScanTime });
  });

  // API: Manual trigger (still useful)
  app.post("/api/scan", async (req, res) => {
    if (isScanning) {
      return res.status(409).json({ error: "Scan already in progress" });
    }
    performScan(); // Trigger in background
    res.json({ success: true, message: "Scan started" });
  });

  // API: Update photo location (Manual)
  app.post("/api/photos/:id/location", (req, res) => {
    const { id } = req.params;
    const { latitude, longitude } = req.body;
    db.prepare("UPDATE photos SET latitude = ?, longitude = ?, has_gps = 1 WHERE id = ?")
      .run(latitude, longitude, id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
