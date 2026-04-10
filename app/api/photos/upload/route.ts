import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadPhoto } from "@/app/actions/inspection-photos";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { propertyId, base64Image, caption } = body as {
      propertyId?: string;
      base64Image?: string;
      caption?: string;
    };

    if (!propertyId || !base64Image) {
      return NextResponse.json(
        { ok: false, error: "Missing propertyId or base64Image" },
        { status: 400 },
      );
    }

    const result = await uploadPhoto(propertyId, base64Image, caption);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      url: result.photo!.url,
      photoId: result.photo!.id,
    });
  } catch (e) {
    console.error("[photos/upload] error:", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
