import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      include: { _count: { select: { bookings: true } } },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(customers);
  } catch (error) {
    console.error("Customers query failed:", error);
    return jsonError("Could not load customers. Check the database connection.", 503);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!name || !phone) return jsonError("Customer name and phone are required.");

    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        email: email || null,
        address: String(body.address ?? "").trim() || null,
      },
    });
    return Response.json(customer, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError("Request body must be valid JSON.");
    if (error.code === "P2002") return jsonError("A customer with this phone or email already exists.", 409);
    console.error("Customer creation failed:", error);
    return jsonError("Could not create customer.", 500);
  }
}