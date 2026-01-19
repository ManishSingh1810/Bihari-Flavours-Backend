const fs = require("fs");
const cloudinary = require("../config/cloudinary");
const Homepage = require("../models/homepage.model");

const ensureArray = (val) => (Array.isArray(val) ? val : []);

const normalizeSlides = (slides) =>
  ensureArray(slides).map((s) => ({
    imageUrl: String(s?.imageUrl || ""),
    title: String(s?.title || ""),
    subtitle: String(s?.subtitle || ""),
    link: String(s?.link || ""),
  }));

const getOrCreateHomepage = async () => {
  let doc = await Homepage.findOne({ key: "default" });
  if (!doc) doc = await Homepage.create({ key: "default", heroSlides: [] });
  return doc;
};

/* =====================
   GET /api/homepage
===================== */
exports.getHomepage = async (req, res) => {
  try {
    const homepage = await getOrCreateHomepage();
    return res.status(200).json({ success: true, homepage });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Failed to fetch homepage" });
  }
};

/* =====================
   PUT /api/admin/homepage (multipart/form-data)
   fields:
   - heroSlides: JSON string
   - hero1, hero2, hero3: files (optional)
===================== */
exports.updateHomepage = async (req, res) => {
  try {
    const homepage = await getOrCreateHomepage();

    // 1) Parse incoming slides JSON
    let incomingSlides = null;
    if (req.body && typeof req.body.heroSlides === "string" && req.body.heroSlides.trim()) {
      try {
        incomingSlides = normalizeSlides(JSON.parse(req.body.heroSlides));
      } catch (e) {
        return res.status(400).json({ success: false, message: "heroSlides must be valid JSON" });
      }
    }

    // Start from either incoming or current
    const slides = incomingSlides ?? normalizeSlides(homepage.heroSlides);

    // 2) Upload provided hero images and map to slide indexes.
    // Supports:
    // - hero1/hero2/hero3 (recommended)
    // - heroN (any N)
    // - heroImages[] where each file has a fieldname like heroImages (falls back to 1..n order)
    const files = Array.isArray(req.files) ? req.files : [];
    const heroFiles = files.filter((f) => f && typeof f.fieldname === "string");

    // Helper: ensure slide exists
    const ensureSlide = (idx) => {
      while (slides.length <= idx) slides.push({ imageUrl: "", title: "", subtitle: "", link: "" });
    };

    // First, handle explicit heroN fields
    const explicit = [];
    const implicit = [];

    for (const f of heroFiles) {
      const m = /^hero(\d+)$/.exec(f.fieldname);
      if (m) explicit.push({ file: f, idx: Math.max(parseInt(m[1], 10) - 1, 0) });
      else implicit.push(f);
    }

    // Upload explicit heroN
    for (const { file, idx } of explicit) {
      ensureSlide(idx);
      const upload = await cloudinary.uploader.upload(file.path, { folder: "homepage" });
      slides[idx].imageUrl = upload.secure_url;
      try {
        fs.unlinkSync(file.path);
      } catch {}
    }

    // Upload remaining files in order (heroImages etc.) -> slide 0,1,2...
    for (let i = 0; i < implicit.length; i += 1) {
      const file = implicit[i];
      ensureSlide(i);
      const upload = await cloudinary.uploader.upload(file.path, { folder: "homepage" });
      slides[i].imageUrl = upload.secure_url;
      try {
        fs.unlinkSync(file.path);
      } catch {}
    }

    homepage.heroSlides = slides;
    await homepage.save();

    return res.status(200).json({
      success: true,
      message: "Homepage updated successfully",
      homepage,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Failed to update homepage" });
  }
};

