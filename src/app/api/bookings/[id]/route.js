import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";

const allowedTransitions = {
  CONFIRMED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["RETURNED"],
  RETURNED: [],
  CANCELLED: [],
};

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { status } = await request.json();
    if (!Object.hasOwn(allowedTransitions, status)) return jsonError("Unknown booking status.");

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return jsonError("Booking not found.", 404);
    if (!allowedTransitions[booking.status].includes(status)) {
      return jsonError(`A ${booking.status.toLowerCase()} booking cannot be changed to ${status.toLowerCase()}.`, 409);
    }

    const updated = await prisma.booking.updateMany({
      where: { id, status: booking.status },
      data: { status },
    });
    if (updated.count !== 1) return jsonError("Booking changed in another request. Refresh and try again.", 409);
    return Response.json({ id, status });
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError("Request body must be valid JSON.");
    console.error("Booking update failed:", error);
    return jsonError("Could not update booking.", 500);
  }
}