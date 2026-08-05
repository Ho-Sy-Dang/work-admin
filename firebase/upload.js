async function uploadImage(file) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", "English-web");
  formData.append("folder", "English-img");

  try {
    const response = await fetch(
      "https://api.cloudinary.com/v1_1/gw764vem/image/upload",
      {
        method: "POST",
        body: formData,
      },
    );

    const data = await response.json();

    if (data.secure_url) {
      return data.secure_url;
    }

    throw new Error("Upload thất bại");
  } catch (error) {
    console.error(error);

    return null;
  }
}

// Upload file âm thanh/video (mp3, mp4) cho phần Listening.
// Cloudinary dùng chung endpoint "/video/upload" cho cả audio lẫn video.
async function uploadAudio(file) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", "English-web");
  formData.append("folder", "English-audio");

  try {
    const response = await fetch(
      "https://api.cloudinary.com/v1_1/gw764vem/video/upload",
      {
        method: "POST",
        body: formData,
      },
    );

    const data = await response.json();

    if (data.secure_url) {
      return data.secure_url;
    }

    throw new Error("Upload thất bại");
  } catch (error) {
    console.error(error);

    return null;
  }
}
