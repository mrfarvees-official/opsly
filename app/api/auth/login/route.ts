import { NextResponse } from "next/server";

import { LoginService } from "@/features/auth/application/login-service";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from "@/features/auth/infrastructure/session";

const loginService = new LoginService();

interface LoginRequest {
  tenantSlug?: unknown;
  email?: unknown;
  password?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as LoginRequest | null;

    if (
      !body ||
      typeof body.tenantSlug !== "string" ||
      typeof body.email !== "string" ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid login payload." },
        { status: 400 },
      );
    }

    const user = await loginService.authenticate({
      tenantSlug: body.tenantSlug,
      email: body.email,
      password: body.password,
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid workspace, email or password." },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      userId: user.userId,
      tenantId: user.tenantId,
    });

    response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("Login failed:", error);

    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
