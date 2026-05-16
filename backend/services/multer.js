const multer = require('multer');
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../services/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "public/listing",
    // No format restriction — accept jpeg, png, jpg, webp, gif, avif, etc.
    transformation: [{ width: 1200, height: 900, crop: "limit", quality: "auto" }],
  },
});

const upload=multer({
  storage: storage,
  limits:{
    fileSize:5*1024*1024
  },
});

module.exports=upload;