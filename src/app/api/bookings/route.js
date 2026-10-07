import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";

const activeStatuses = ["CONFIRMED", "ACTIVE"];

function dayCount(startDate, endDate) {
  return Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));
}

export async function GET() {
  try {
    const bookings = await prisma.booking.findMany({
      include: { customer: true, items: { include: { product: true } } },
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
    return Response.json(bookings.map((booking) => ({
      ...booking,
      rentalTotal: Number(booking.rentalTotal),
      depositTotal: Number(booking.depositTotal),
      items: booking.items.map((item) => ({
        ...item,
        dailyRate: Number(item.dailyRate),
        deposit: Number(item.deposit),
      })),
    })));
  } catch (error) {
    console.error("Bookings query failed:", error);
    return jsonError("Could not load bookings. Check the database connection.", 503);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const customerId = String(body.customerId ?? "");
    const startDate = new Date(`${body.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${body.endDate}T00:00:00.000Z`);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!customerId || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      return jsonError("Choose a customer and valid rental dates. Return date must be after pickup.");
    }
    if (!items.length || items.some((item) => !item.productId || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)) {
      return jsonError("Choose at least one product and a quantity of one or more.");
    }

    const requested = new Map();
    for (const item of items) requested.set(item.productId, (requested.get(item.productId) ?? 0) + Number(item.quantity));
    const days = dayCount(startDate, endDate);

    const booking = await prisma.$transaction(async (transaction) => {
      const customer = await transaction.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new Error("CUSTOMER_NOT_FOUND");

      const products = await transaction.product.findMany({ where: { id: { in: [...requested.keys()] } } });
      if (products.length !== requested.size) throw new Error("PRODUCT_NOT_FOUND");

      const overlapping = await transaction.bookingItem.findMany({
        where: {
          productId: { in: [...requested.keys()] },
          booking: {
            status: { in: activeStatuses },
            startDate: { lt: endDate },
            endDate: { gt: startDate },
          },
        },
        select: { productId: true, quantity: true },
      });
      const alreadyReserved = new Map();
      for (const item of overlapping) {
        alreadyReserved.set(item.productId, (alreadyReserved.get(item.productId) ?? 0) + item.quantity);
      }

      const productById = new Map(products.map((product) => [product.id, product]));
      for (const [productId, quantity] of requested) {
        const product = productById.get(productId);
        if ((alreadyReserved.get(productId) ?? 0) + quantity > product.quantity) {
          throw new Error(`NOT_AVAILABLE:${product.name}`);
        }
      }

      const rentalTotal = [...requested].reduce((sum, [productId, quantity]) => {
        return sum + Number(productById.get(productId).dailyRate) * quantity * days;
      }, 0);
      const depositTotal = [...requested].reduce((sum, [productId, quantity]) => {
        return sum + Number(productById.get(productId).securityDeposit) * quantity;
      }, 0);

      return transaction.booking.create({
        data: {
          customerId,
          startDate,
          endDate,
          rentalTotal,
          depositTotal,
          items: {
            create: [...requested].map(([productId, quantity]) => {
              const product = productById.get(productId);
              return { productId, quantity, dailyRate: product.dailyRate, deposit: product.securityDeposit };
            }),
          },
        },
        include: { customer: true, items: { include: { product: true } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return Response.json(booking, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError("Request body must be valid JSON.");
    if (error.message === "CUSTOMER_NOT_FOUND") return jsonError("Customer not found.", 404);
    if (error.message === "PRODUCT_NOT_FOUND") return jsonError("A selected product no longer exists.", 404);
    if (error.message?.startsWith("NOT_AVAILABLE:")) return jsonError(`${error.message.slice(14)} is not available for those dates.`, 409);
    if (error.code === "P2034") return jsonError("Inventory changed during booking. Please check availability and try again.", 409);
    console.error("Booking creation failed:", error);
    return jsonError("Could not create booking.", 500);
  }
}