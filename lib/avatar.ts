export const ADMIN_AVATAR_URL =
  "https://res.cloudinary.com/dv4qomvdt/image/upload/v1777993300/ChatGPT_Image_May_5_2026_08_54_30_AM_1_zpduah.png";

export function getDefaultAvatarUrl() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <rect width="96" height="96" fill="#111827"/>
      <circle cx="48" cy="48" r="40" fill="#e5e7eb"/>
      <circle cx="48" cy="38" r="14" fill="#7b7f86"/>
      <path d="M20 78c5.6-16 16.3-24 28-24s22.4 8 28 24c-7.2 6.2-16.7 10-28 10s-20.8-3.8-28-10Z" fill="#7b7f86"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

export function getAvatarUrl(photoUrl?: string | null) {
  const clean = String(photoUrl || "").trim();
  return clean || getDefaultAvatarUrl();
}

export function getAdminAvatarUrl() {
  return ADMIN_AVATAR_URL;
}
