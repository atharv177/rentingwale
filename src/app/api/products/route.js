import { prisma } from "@/lib/prisma";
import { jsonError, parsePositiveNumber } from "@/lib/http";

export async function GET() {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
    return Response.json(products.map((product) => ({
      ...product,
      dailyRate: Number(product.dailyRate),
      securityDeposit: Number(product.securityDeposit),
    })));
  } catch (error) {
    console.error("Products query failed:", error);
    return jsonError("Could not load products. Check the database connection.", 503);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const category = String(body.category ?? "").trim();
    if (!name || !category) return jsonError("Product name and category are required.");

    const product = await prisma.product.create({
      data: {
        name,
        category,
        dailyRate: parsePositiveNumber(body.dailyRate, "Daily rate"),
        securityDeposit: parsePositiveNumber(body.securityDeposit ?? 0, "Security deposit"),
        quantity: Math.max(1, Math.floor(Number(body.quantity) || 1)),
        condition: String(body.condition ?? "Good").trim() || "Good",
        description: String(body.description ?? "").trim() || null,
      },
    });
    return Response.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError("Request body must be valid JSON.");
    if (error.message?.includes("must be a non-negative")) return jsonError(error.message);
    if (error.code === "P2002") return jsonError("A product with this name already exists.", 409);
    console.error("Product creation failed:", error);
    return jsonError("Could not create product.", 500);
  }
}