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

    // 2) Upload provided hero images and map to slide indexes
    const fileMap = [
      { field: "hero1", idx: 0 },
      { field: "hero2", idx: 1 },
      { field: "hero3", idx: 2 },
    ];

    for (const { field, idx } of fileMap) {
      const fileArr = req.files?.[field];
      const file = Array.isArray(fileArr) ? fileArr[0] : null;
      if (!file) continue;

      // Ensure slide exists
      while (slides.length <= idx) slides.push({ imageUrl: "", title: "", subtitle: "", link: "" });

      const upload = await cloudinary.uploader.upload(file.path, {
        folder: "homepage",
      });

      slides[idx].imageUrl = upload.secure_url;

      // Clean temp file
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

