import "server-only";

import { NextResponse } from "next/server";

import {
  HttpError,
  badRequest,
  pgCode,
} from "@/features/platform/domain/errors";

/** Runs a handler body and turns thrown errors into JSON responses. */
export async function respond(
  fn: () => Promise<unknown>,
  status = 200,
): Promise<Response> {
  try {
    const result = await fn();
    if (result instanceof Response) return result;
    return NextResponse.json(result ?? { ok: true }, { status });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    const code = pgCode(error);
    if (code === "23505")
      return NextResponse.json(
        { error: "That already exists." },
        { status: 409 },
      );
    if (code === "23503")
      return NextResponse.json(
        { error: "That refers to something that doesn't exist." },
        { status: 400 },
      );
    console.error("Request failed:", error);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 },
    );
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest("Send a JSON body.");
  }
}
