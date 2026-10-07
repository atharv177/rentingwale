import "./globals.css";

export const metadata = {
  title: "RentingWale | Rental operations",
  description: "Manage rental inventory, customers, and bookings in one place.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}