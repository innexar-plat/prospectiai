import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateTotpSecret } from "@/lib/twofa";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, twoFactorEnabled: true },
    });
    if (!user?.email) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.twoFactorEnabled) {
      return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 });
    }
    const { secret, otpauthUrl } = generateTotpSecret(user.email);
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret },
    });
    return NextResponse.json({ secret, otpauthUrl });
  } catch (error) {
    logger.error("2FA enable error", { error: error instanceof Error ? error.message : "Unknown" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
