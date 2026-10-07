import { prisma } from "@/lib/prisma";
import { jsonError, parsePositiveNumber } from "@/lib/http";

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const category = String(body.category ?? "").trim();
    const quantity = Number(body.quantity);
    if (!name || !category) return jsonError("Product name and category are required.");
    if (!Number.isInteger(quantity) || quantity < 1) return jsonError("Quantity must be a whole number of at least one.");

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return jsonError("Product not found.", 404);

    const reserved = await prisma.bookingItem.aggregate({
      where: { productId: id, booking: { status: { in: ["CONFIRMED", "ACTIVE"] } } },
      _sum: { quantity: true },
    });
    if (quantity < (reserved._sum.quantity ?? 0)) {
      return jsonError("Quantity cannot be lower than units reserved in confirmed or active bookings.", 409);
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        category,
        dailyRate: parsePositiveNumber(body.dailyRate, "Daily rate"),
        securityDeposit: parsePositiveNumber(body.securityDeposit ?? 0, "Security deposit"),
        quantity,
        condition: String(body.condition ?? "Good").trim() || "Good",
        description: String(body.description ?? "").trim() || null,
      },
    });
    return Response.json({ ...product, dailyRate: Number(product.dailyRate), securityDeposit: Number(product.securityDeposit) });
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError("Request body must be valid JSON.");
    if (error.message?.includes("must be a non-negative")) return jsonError(error.message);
    if (error.code === "P2002") return jsonError("A product with this name already exists.", 409);
    console.error("Product update failed:", error);
    return jsonError("Could not update product.", 500);
  }
}