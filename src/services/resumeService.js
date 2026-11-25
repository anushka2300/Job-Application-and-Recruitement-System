const cloudinary = require("../config/cloudinary");
const { Readable } = require("stream");
const { randomUUID } = require("crypto");

const uploadResume = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        type: "authenticated",
        public_id: `resumes/${randomUUID()}.pdf`,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        if (!result || !result.public_id) {
          return reject(new Error("Cloudinary did not return a resume reference"));
        }

        resolve({
          publicId: result.public_id,
        });
      },
    );

    const source = Readable.from([buffer]);
    source.on("error", reject);
    uploadStream.on("error", reject);
    source.pipe(uploadStream);
  });
};

const deleteResume = (publicId) => cloudinary.uploader.destroy(publicId, {
  resource_type: "raw",
  type: "authenticated",
});

const createResumeViewUrl = (publicId) =>
  cloudinary.utils.private_download_url(publicId, "pdf", {
    resource_type: "raw",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 300,
    attachment: false,
  });

module.exports = { createResumeViewUrl, deleteResume, uploadResume };