import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidEvidenceImage, MAX_REPORT_IMAGES } from "@/lib/report-safety";

const DEFAULT_BUCKET = "report-evidence-v2";

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const bucket = (process.env.REPORT_EVIDENCE_BUCKET || DEFAULT_BUCKET).trim();
    if (!url || !serviceRole) {
      return NextResponse.json({ ok: false, error: "service_upload_not_configured" }, { status: 500 });
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

    const supabase = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const uploadedUrls: string[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const safeName = file.name.replace(/\s+/g, "_").replace(/[^\w.-]/g, "");
      const filePath = `${ownerKey}/${Date.now()}_${i}_${safeName}`;
      const fileBuffer = await file.arrayBuffer();
      const { error } = await supabase.storage.from(bucket).upload(filePath, fileBuffer, {
        upsert: false,
        contentType: file.type,
      });
      if (error) {
        return NextResponse.json(
          { ok: false, error: "upload_failed", details: String(error.message || error) },
          { status: 400 }
        );
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      uploadedUrls.push(data.publicUrl);
    }

    return NextResponse.json({ ok: true, urls: uploadedUrls });
  } catch {
    return NextResponse.json({ ok: false, error: "unexpected_upload_error" }, { status: 500 });
  }
}
