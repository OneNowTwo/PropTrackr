import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadInspectionPhoto(
  base64Data: string,
  propertyId: string,
): Promise<string> {
  const result = await cloudinary.uploader.upload(base64Data, {
    folder: `proptrackr/${propertyId}`,
    transformation: [{ width: 1200, quality: "auto" }],
  });
  return result.secure_url;
}

export async function deleteCloudinaryPhoto(url: string): Promise<void> {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
  if (!match) return;
  const publicId = match[1];
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (e) {
    console.warn("[cloudinary] failed to delete:", publicId, e);
  }
}
