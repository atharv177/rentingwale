import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const weekStart = new Date(today);
    weekStart.setUTCDate(today.getUTCDate() - 6);

    const [productCount, customerCount, activeBookings, todayBookings, todayReturns, monthBookings, recentBookings, products, chartBookings] = await Promise.all([
      prisma.product.count(),
      prisma.customer.count(),
      prisma.booking.count({ where: { status: "ACTIVE" } }),
      prisma.booking.count({ where: { createdAt: { gte: today } } }),
      prisma.booking.count({ where: { status: "ACTIVE", endDate: today } }),
      prisma.booking.aggregate({ where: { status: { not: "CANCELLED" }, createdAt: { gte: monthStart } }, _sum: { rentalTotal: true } }),
      prisma.booking.findMany({
        where: { status: { in: ["CONFIRMED", "ACTIVE"] } },
        include: { customer: true, items: { include: { product: true } } },
        orderBy: { endDate: "asc" },
        take: 5,
      }),
      prisma.product.findMany({ select: { category: true, quantity: true, bookingItems: { where: { booking: { status: { in: ["CONFIRMED", "ACTIVE"] }, startDate: { lte: today }, endDate: { gt: today } } }, select: { quantity: true } } } }),
      prisma.booking.findMany({
        where: { status: { not: "CANCELLED" }, createdAt: { gte: weekStart } },
        select: { createdAt: true, rentalTotal: true },
      }),
    ]);

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setUTCDate(weekStart.getUTCDate() + index);
      return { date: dateKey(date), label: new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(date), bookings: 0, revenue: 0 };
    });
    const chartByDate = new Map(days.map((day) => [day.date, day]));
    for (const booking of chartBookings) {
      const day = chartByDate.get(dateKey(booking.createdAt));
      if (day) {
        day.bookings += 1;
        day.revenue += Number(booking.rentalTotal);
      }
    }

    const categories = new Map();
    let availableUnits = 0;
    for (const product of products) {
      const reserved = product.bookingItems.reduce((sum, item) => sum + item.quantity, 0);
      availableUnits += Math.max(0, product.quantity - reserved);
      categories.set(product.category, (categories.get(product.category) ?? 0) + reserved);
    }

    return Response.json({
      metrics: {
        productCount,
        customerCount,
        activeBookings,
        todayBookings,
        todayReturns,
        monthlyRevenue: Number(monthBookings._sum.rentalTotal ?? 0),
        availableUnits,
      },
      upcomingReturns: recentBookings.map((booking) => ({
        id: booking.id,
        customer: booking.customer.name,
        dueDate: dateKey(booking.endDate),
        status: booking.status,
        products: booking.items.map((item) => item.product.name).join(", "),
      })),
      weekly: days,
      categories: [...categories].map(([name, units]) => ({ name, units })),
    });
  } catch (error) {
    console.error("Dashboard query failed:", error);
    return jsonError("Could not load dashboard. Check the database connection.", 503);
  }
}