import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { isValidEvidenceImage, MAX_REPORT_IMAGES } from "@/lib/report-safety";

const DEFAULT_FOLDER = "trackify/report-evidence";

export async function POST(req: Request) {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    const folder = (process.env.CLOUDINARY_REPORT_FOLDER || DEFAULT_FOLDER).trim();
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ ok: false, error: "cloudinary_not_configured" }, { status: 500 });
    }

    const formData = await req.formData();
    const ownerKey = String(formData.get("ownerKey") || `guest_${Date.now()}`).replace(/[^\w-]/g, "");
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => typeof entry !== "string")
      .slice(0, MAX_REPORT_IMAGES);

    if (!files.length) {
      return NextResponse.json({ ok: true, urls: [] });
    }

    const invalid = files.find((file) => !isValidEvidenceImage(file));
    if (invalid) {
      return NextResponse.json({ ok: false, error: "invalid_file_type_or_size" }, { status: 400 });
    }

    const uploadedUrls: string[] = [];
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signatureBase = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(signatureBase).digest("hex");

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const safeName = file.name.replace(/\s+/g, "_").replace(/[^\w.-]/g, "");
      const uploadPayload = new FormData();
      uploadPayload.append("file", file);
      uploadPayload.append("api_key", apiKey);
      uploadPayload.append("timestamp", timestamp);
      uploadPayload.append("folder", folder);
      uploadPayload.append("signature", signature);
      uploadPayload.append("public_id", `${ownerKey}_${Date.now()}_${i}_${safeName.replace(/\.[^.]+$/, "")}`);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: uploadPayload,
      });
      if (!uploadRes.ok) {
        const body = (await uploadRes.json().catch(() => ({}))) as { error?: { message?: string } };
        const details = body.error?.message || `Cloudinary upload failed with status ${uploadRes.status}`;
        return NextResponse.json(
          { ok: false, error: "upload_failed", details },
          { status: 400 }
        );
      }
      const body = (await uploadRes.json()) as { secure_url?: string };
      if (!body.secure_url) {
        return NextResponse.json(
          { ok: false, error: "upload_failed", details: "Cloudinary did not return a secure URL." },
          { status: 400 }
        );
      }
      uploadedUrls.push(body.secure_url);
    }

    return NextResponse.json({ ok: true, urls: uploadedUrls });
  } catch {
    return NextResponse.json({ ok: false, error: "unexpected_upload_error" }, { status: 500 });
  }
}
