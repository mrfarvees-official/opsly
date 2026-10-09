import { NextResponse } from "next/server";

import { TenantOwnerProvisioningService } from "@/features/tenant/application/tenant-owner-provisioning-service";

const provisioningService = new TenantOwnerProvisioningService();

interface RegisterRequest {
  tenantName?: unknown;
  tenantSlug?: unknown;
  email?: unknown;
  password?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterRequest;

    if (
      typeof body.tenantName !== "string" ||
      typeof body.tenantSlug !== "string" ||
      typeof body.email !== "string" ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json(
        {
          error: "Invalid registration payload.",
        },
        {
          status: 400,
        },
      );
    }

    if (body.password.length < 12) {
      return NextResponse.json(
        { error: "Use at least 12 characters for your password." },
        { status: 400 },
      );
    }

    const result = await provisioningService.createTenantOwner({
      tenantName: body.tenantName,

      tenantSlug: body.tenantSlug,

      ownerEmail: body.email,

      ownerPassword: body.password,
    });

    return NextResponse.json(
      {
        tenantId: result.tenantId,

        ownerId: result.ownerId,

        tenantDatabaseId: result.tenantDatabaseId,

        databaseName: result.databaseName,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Tenant owner registration failed:", error);

    const cause = (error as { cause?: { code?: string } }).cause;

    // PostgreSQL unique_violation: tenant slug or owner email already used.
    if (cause?.code === "23505") {
      return NextResponse.json(
        { error: "That workspace address is already taken. Try another." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: "Tenant owner registration failed.",
      },
      {
        status: 500,
      },
    );
  }
}
