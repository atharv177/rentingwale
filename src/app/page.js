"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  LayoutDashboard,
  Pencil,
  Plus,
  Search,
  Shirt,
  UsersRound,
  Wallet,
  X,
  Boxes,
  ClipboardList,
  PackageCheck,
} from "lucide-react";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" });
const todayValue = new Date().toISOString().slice(0, 10);
const tomorrowValue = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

async function request(url, options) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function dateLabel(value) {
  return shortDate.format(new Date(`${String(value).slice(0, 10)}T00:00:00`));
}

function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function Status({ status }) {
  const label = status.toLowerCase().replaceAll("_", " ");
  return <span className={`status status-${status.toLowerCase()}`}><span />{label}</span>;
}

function EmptyState({ title, detail }) {
  return <div className="empty-state"><Boxes size={22} /><strong>{title}</strong><span>{detail}</span></div>;
}

function FormField({ label, children }) {
  return <label className="form-field"><span>{label}</span>{children}</label>;
}

export default function Home() {
  const [view, setView] = useState("Overview");
  const [data, setData] = useState({ dashboard: null, products: [], customers: [], bookings: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [todayLabel, setTodayLabel] = useState("");
  const [weekdayLabel, setWeekdayLabel] = useState("");

  useEffect(() => {
    const now = new Date();
    setTodayLabel(new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(now));
    setWeekdayLabel(new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(now).toUpperCase());
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const [dashboard, products, customers, bookings] = await Promise.all([
          request("/api/dashboard"),
          request("/api/products"),
          request("/api/customers"),
          request("/api/bookings"),
        ]);
        if (!ignore) {
          setData({ dashboard, products, customers, bookings });
          setLoadError("");
        }
      } catch (error) {
        if (!ignore) setLoadError(error.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, [refreshKey]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(""), 3600);
    return () => clearTimeout(timeout);
  }, [notice]);

  const { dashboard, products, customers, bookings } = data;
  const filteredProducts = products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase()));
  const filteredCustomers = customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.email || ""}`.toLowerCase().includes(query.toLowerCase()));
  const filteredBookings = bookings.filter((booking) => `${booking.customer.name} ${booking.id} ${booking.items.map((item) => item.product.name).join(" ")}`.toLowerCase().includes(query.toLowerCase()));

  async function submitForm(event) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    try {
      if (dialog === "product" || dialog === "product-edit") {
        const editing = dialog === "product-edit";
        await request(editing ? `/api/products/${editingProduct.id}` : "/api/products", {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(values),
        });
        setNotice(editing ? "Product details updated." : "Product added to your inventory.");
      } else if (dialog === "customer") {
        await request("/api/customers", { method: "POST", body: JSON.stringify(values) });
        setNotice("Customer profile created.");
      } else {
        await request("/api/bookings", {
          method: "POST",
          body: JSON.stringify({
            customerId: values.customerId,
            startDate: values.startDate,
            endDate: values.endDate,
            items: [{ productId: values.productId, quantity: Number(values.quantity) }],
          }),
        });
        setNotice("Booking confirmed. Inventory availability updated.");
      }
      setDialog("");
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeBookingStatus(id, status) {
    try {
      await request(`/api/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice(status === "RETURNED" ? "Return marked complete." : "Booking moved to active rentals.");
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setNotice(error.message);
    }
  }

  function openView(nextView) {
    setView(nextView);
    setQuery("");
  }

  const navItems = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "Bookings", icon: ClipboardList, count: bookings.length },
    { name: "Inventory", icon: Boxes, count: products.length },
    { name: "Customers", icon: UsersRound, count: customers.length },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => openView("Overview")}>
          <span className="brand-mark"><Boxes size={19} strokeWidth={2.3} /></span>
          <span><strong>rentingwale</strong><small>RENTAL OPERATIONS</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ name, icon: Icon, count }) => (
            <button className={view === name ? "nav-item active" : "nav-item"} key={name} onClick={() => openView(name)}>
              <Icon size={18} strokeWidth={1.8} /><span>{name}</span>{count > 0 && <small>{count}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-note">
            <div className="help-icon"><CircleAlert size={17} /></div>
            <strong>Need a hand?</strong>
            <span>Keep your rental desk running smoothly.</span>
            <a href="mailto:support@rentingwale.in">Contact support <ArrowUpRight size={13} /></a>
          </div>
          <button className="profile-button">
            <span className="avatar avatar-olive">AA</span>
            <span className="profile-copy"><strong>Atharv Awari</strong><small>Store administrator</small></span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{view}</strong></div>
          <div className="top-actions">
            <span className="today-chip"><CalendarDays size={15} />{todayLabel}</span>
            <button className="icon-button notification-button" title="Notifications" aria-label="Notifications"><Bell size={18} /><i /></button>
            <button className="user-chip"><span className="avatar avatar-olive">AA</span><ChevronDown size={14} /></button>
          </div>
        </header>

        <div className="page-wrap">
          {loadError ? (
            <section className="setup-panel">
              <div className="setup-icon"><CircleAlert size={23} /></div>
              <div><p className="eyebrow">DATABASE CONNECTION</p><h1>Connect your PostgreSQL database</h1><p>{loadError}</p>
                <ol><li>Copy <code>.env.example</code> to <code>.env</code>.</li><li>Start PostgreSQL with <code>docker compose up -d db</code>.</li><li>Run <code>npx prisma migrate dev --name init</code>, then <code>npm run db:seed</code>.</li></ol>
                <button className="button button-dark" onClick={() => setRefreshKey((key) => key + 1)}>Try connection again</button>
              </div>
            </section>
          ) : (
            <>
              <section className="page-heading">
                <div><p className="eyebrow">{weekdayLabel ? `${weekdayLabel}, ` : ""}YOUR STORE AT A GLANCE</p><h1>{view === "Overview" ? "Good morning, Atharv" : view}</h1><p className="heading-subtitle">{view === "Overview" ? "Here’s what’s happening across your rental business today." : `Manage your ${view.toLowerCase()} and keep every rental moving.`}</p></div>
                <button className="button button-dark" onClick={() => setDialog("booking")}><Plus size={17} />New booking</button>
              </section>

              {loading && <div className="loading-line"><span /> Syncing your rental desk…</div>}

              {view === "Overview" && <Overview dashboard={dashboard} bookings={bookings} onNavigate={openView} onStatusChange={changeBookingStatus} />}
              {view === "Bookings" && <BookingsView bookings={filteredBookings} onStatusChange={changeBookingStatus} onCreate={() => setDialog("booking")} />}
              {view === "Inventory" && <InventoryView products={filteredProducts} query={query} setQuery={setQuery} onCreate={() => { setEditingProduct(null); setDialog("product"); }} onEdit={(product) => { setEditingProduct(product); setDialog("product-edit"); }} />}
              {view === "Customers" && <CustomersView customers={filteredCustomers} query={query} setQuery={setQuery} onCreate={() => setDialog("customer")} />}
            </>
          )}
        </div>
      </main>

      {dialog && <Modal title={dialog === "product-edit" ? "Edit product" : dialog === "product" ? "Add a product" : dialog === "customer" ? "Add a customer" : "Create a booking"} onClose={() => setDialog("")}>
        <form className="modal-form" onSubmit={submitForm}>
          {(dialog === "product" || dialog === "product-edit") && <>
            <FormField label="Product name"><input name="name" defaultValue={editingProduct?.name ?? ""} placeholder="e.g. Black designer suit" required autoFocus /></FormField>
            <div className="form-grid">
              <FormField label="Category"><select name="category" defaultValue={editingProduct?.category ?? "Clothing"}><option>Clothing</option><option>Electronics</option><option>Jewellery</option><option>Equipment</option><option>Other</option></select></FormField>
              <FormField label="Condition"><select name="condition" defaultValue={editingProduct?.condition ?? "Good"}><option>Excellent</option><option>Premium / Clean</option><option>Good</option><option>Fair</option></select></FormField>
            </div>
            <div className="form-grid three-columns">
              <FormField label="Daily rate (₹)"><input name="dailyRate" type="number" min="0" step="1" defaultValue={editingProduct?.dailyRate ?? ""} placeholder="1500" required /></FormField>
              <FormField label="Deposit (₹)"><input name="securityDeposit" type="number" min="0" step="1" defaultValue={editingProduct?.securityDeposit ?? ""} placeholder="3000" required /></FormField>
              <FormField label="Units"><input name="quantity" type="number" min="1" step="1" defaultValue={editingProduct?.quantity ?? 1} required /></FormField>
            </div>
            <FormField label="Description"><input name="description" defaultValue={editingProduct?.description ?? ""} placeholder="Optional details" /></FormField>
          </>}
          {dialog === "customer" && <>
            <FormField label="Full name"><input name="name" placeholder="Customer name" required autoFocus /></FormField>
            <div className="form-grid">
              <FormField label="Phone"><input name="phone" type="tel" placeholder="+91 98765 43210" required /></FormField>
              <FormField label="Email"><input name="email" type="email" placeholder="name@example.com" /></FormField>
            </div>
            <FormField label="Address"><input name="address" placeholder="Optional address" /></FormField>
          </>}
          {dialog === "booking" && <>
            {customers.length === 0 || products.length === 0 ? <div className="form-notice">Add at least one customer and product before creating a booking.</div> : <>
              <FormField label="Customer"><select name="customerId" required defaultValue=""><option value="" disabled>Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></FormField>
              <FormField label="Product"><select name="productId" required defaultValue="">{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {money.format(product.dailyRate)} / day</option>)}</select></FormField>
              <div className="form-grid three-columns">
                <FormField label="Pickup"><input name="startDate" type="date" min={todayValue} defaultValue={todayValue} required /></FormField>
                <FormField label="Return"><input name="endDate" type="date" min={tomorrowValue} defaultValue={tomorrowValue} required /></FormField>
                <FormField label="Units"><input name="quantity" type="number" min="1" defaultValue="1" required /></FormField>
              </div>
              <p className="form-hint">Availability and rental total are calculated when you confirm.</p>
            </>}
          </>}
          <div className="modal-actions"><button type="button" className="button button-light" onClick={() => setDialog("")}>Cancel</button><button className="button button-dark" disabled={busy || (dialog === "booking" && (!customers.length || !products.length))}>{busy ? "Saving…" : dialog === "booking" ? "Check & confirm" : "Save changes"}</button></div>
        </form>
      </Modal>}

      {notice && <div className="toast" role="status"><span><Check size={16} /></span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={16} /></button></div>}
    </div>
  );
}

function Overview({ dashboard, bookings, onNavigate, onStatusChange }) {
  const metrics = dashboard?.metrics;
  const week = dashboard?.weekly ?? [];
  const maxRevenue = Math.max(1, ...week.map((day) => day.revenue));
  const dueSoon = (dashboard?.upcomingReturns ?? []).slice(0, 4);
  return <>
    <section className="metric-grid">
      <Metric icon={Boxes} label="Products in stock" value={metrics?.productCount ?? 0} detail={`${metrics?.availableUnits ?? 0} units available today`} accent="green" />
      <Metric icon={UsersRound} label="Total customers" value={metrics?.customerCount ?? 0} detail="Across all rental records" accent="blue" />
      <Metric icon={ClipboardList} label="Active rentals" value={metrics?.activeBookings ?? 0} detail={`${metrics?.todayBookings ?? 0} bookings created today`} accent="orange" />
      <Metric icon={Wallet} label="Revenue this month" value={money.format(metrics?.monthlyRevenue ?? 0)} detail={`${metrics?.todayReturns ?? 0} returns due today`} accent="pink" />
    </section>

    <section className="overview-grid">
      <div className="panel revenue-panel">
        <div className="panel-heading"><div><p className="eyebrow">STORE PERFORMANCE</p><h2>Booking activity</h2></div><span className="period-select">Last 7 days <ChevronDown size={14} /></span></div>
        <div className="chart-summary"><strong>{week.reduce((sum, day) => sum + day.bookings, 0)}</strong><span>bookings this week</span><span className="chart-trend"><ArrowUpRight size={14} /> Live data</span></div>
        <div className="bar-chart" role="img" aria-label="Daily rental revenue for the last seven days">
          {week.map((day) => <div className="bar-column" key={day.date} title={`${day.label}: ${money.format(day.revenue)} · ${day.bookings} bookings`}><div className="bar-track"><span style={{ height: `${Math.max(day.revenue ? 8 : 3, (day.revenue / maxRevenue) * 100)}%` }} /></div><small>{day.label}</small></div>)}
        </div>
        <div className="chart-foot"><span><i className="legend-dot" />Rental revenue</span><span>Revenue is based on confirmed rentals</span></div>
      </div>
      <div className="panel stock-panel">
        <div className="panel-heading"><div><p className="eyebrow">INVENTORY MIX</p><h2>Units on rent</h2></div><button className="text-button" onClick={() => onNavigate("Inventory")}>View inventory <ArrowUpRight size={14} /></button></div>
        <div className="category-list">
          {(dashboard?.categories ?? []).length ? dashboard.categories.map((category, index) => {
            const total = dashboard.categories.reduce((sum, item) => sum + item.units, 0) || 1;
            return <div className="category-row" key={category.name}><div className="category-meta"><span className={`category-swatch swatch-${index % 4}`} />{category.name}<strong>{category.units}</strong></div><div className="category-track"><span className={`category-fill fill-${index % 4}`} style={{ width: `${Math.max(5, category.units / total * 100)}%` }} /></div></div>;
          }) : <EmptyState title="No categories yet" detail="Add products to see your inventory mix." />}
        </div>
        <div className="stock-note"><PackageCheck size={16} /><span><strong>{metrics?.availableUnits ?? 0} units</strong> available to rent today</span></div>
      </div>
    </section>

    <section className="panel due-panel">
      <div className="panel-heading"><div><p className="eyebrow">KEEP RETURNS ON TRACK</p><h2>Upcoming returns</h2></div><button className="text-button" onClick={() => onNavigate("Bookings")}>All bookings <ArrowUpRight size={14} /></button></div>
      {dueSoon.length ? <div className="return-list">{dueSoon.map((booking) => <div className="return-row" key={booking.id}><span className="return-icon"><Clock3 size={17} /></span><div className="return-product"><strong>{booking.products || "Rental items"}</strong><small>{booking.customer} · #{booking.id.slice(-6).toUpperCase()}</small></div><div className="return-date"><strong>{dateLabel(booking.dueDate)}</strong><small>{booking.dueDate === todayValue ? "Due today" : booking.dueDate < todayValue ? "Overdue" : "Return date"}</small></div><Status status={booking.status} />{booking.status === "CONFIRMED" && <button className="row-action" onClick={() => onStatusChange(booking.id, "ACTIVE")}>Start rental</button>}{booking.status === "ACTIVE" && <button className="row-action" onClick={() => onStatusChange(booking.id, "RETURNED")}>Mark returned</button>}</div>)}</div> : <EmptyState title="Nothing due soon" detail="New bookings will show up here." />}
      {bookings.length > 0 && <p className="panel-footnote">Showing the next {dueSoon.length} scheduled returns</p>}
    </section>
  </>;
}

function Metric({ icon: Icon, label, value, detail, accent }) {
  return <article className="metric-card"><div className={`metric-icon metric-${accent}`}><Icon size={18} /></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-detail">{detail}</span></article>;
}

function TableToolbar({ title, count, query, setQuery, action, actionLabel }) {
  return <div className="table-toolbar"><div><h2>{title}</h2><span>{count} records</span></div><div className="toolbar-controls"><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}…`} /></label><button className="button button-dark" onClick={action}><Plus size={16} />{actionLabel}</button></div></div>;
}

function InventoryView({ products, query, setQuery, onCreate, onEdit }) {
  return <section className="panel table-panel"><TableToolbar title="Inventory" count={products.length} query={query} setQuery={setQuery} action={onCreate} actionLabel="Add product" />
    {products.length ? <div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>DAILY RATE</th><th>DEPOSIT</th><th>UNITS</th><th>CONDITION</th><th /></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="product-cell"><span className="product-thumb"><Shirt size={18} /></span><span><strong>{product.name}</strong><small>{product.description || `SKU · ${product.id.slice(-6).toUpperCase()}`}</small></span></div></td><td><span className="category-pill">{product.category}</span></td><td className="table-money">{money.format(product.dailyRate)}<small> / day</small></td><td>{money.format(product.securityDeposit)}</td><td><strong>{product.quantity}</strong> units</td><td><span className="condition-dot" />{product.condition}</td><td><button className="icon-button" title={`Edit ${product.name}`} aria-label={`Edit ${product.name}`} onClick={() => onEdit(product)}><Pencil size={15} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="No products match" detail="Add your first rental item to get started." />}
  </section>;
}

function CustomersView({ customers, query, setQuery, onCreate }) {
  return <section className="panel table-panel"><TableToolbar title="Customers" count={customers.length} query={query} setQuery={setQuery} action={onCreate} actionLabel="Add customer" />
    {customers.length ? <div className="table-scroll"><table><thead><tr><th>CUSTOMER</th><th>PHONE</th><th>EMAIL</th><th>RENTALS</th><th>ADDED</th></tr></thead><tbody>{customers.map((customer, index) => <tr key={customer.id}><td><div className="customer-cell"><span className={`avatar avatar-${index % 4}`}>{initials(customer.name)}</span><strong>{customer.name}</strong></div></td><td>{customer.phone}</td><td>{customer.email || "—"}</td><td><span className="rental-count">{customer._count?.bookings ?? 0} bookings</span></td><td>{shortDate.format(new Date(customer.createdAt))}</td></tr>)}</tbody></table></div> : <EmptyState title="No customers match" detail="Create a customer profile before their first booking." />}
  </section>;
}

function BookingsView({ bookings, onStatusChange, onCreate }) {
  return <section className="panel table-panel"><div className="table-toolbar"><div><h2>Bookings</h2><span>{bookings.length} recent reservations</span></div><button className="button button-dark" onClick={onCreate}><Plus size={16} />New booking</button></div>
    {bookings.length ? <div className="table-scroll"><table><thead><tr><th>BOOKING</th><th>CUSTOMER</th><th>RENTAL PERIOD</th><th>ITEMS</th><th>RENTAL TOTAL</th><th>STATUS</th><th /></tr></thead><tbody>{bookings.map((booking, index) => <tr key={booking.id}><td><strong className="booking-id">#{booking.id.slice(-6).toUpperCase()}</strong><small className="sub-cell">{shortDate.format(new Date(booking.createdAt))}</small></td><td><div className="customer-cell"><span className={`avatar avatar-${index % 4}`}>{initials(booking.customer.name)}</span><strong>{booking.customer.name}</strong></div></td><td>{dateLabel(booking.startDate)} – {dateLabel(booking.endDate)}</td><td>{booking.items.map((item) => `${item.quantity} × ${item.product.name}`).join(", ")}</td><td className="table-money">{money.format(booking.rentalTotal)}<small> + {money.format(booking.depositTotal)} deposit</small></td><td><Status status={booking.status} /></td><td>{booking.status === "CONFIRMED" && <button className="row-action" onClick={() => onStatusChange(booking.id, "ACTIVE")}>Start</button>}{booking.status === "ACTIVE" && <button className="row-action" onClick={() => onStatusChange(booking.id, "RETURNED")}>Return</button>}</td></tr>)}</tbody></table></div> : <EmptyState title="No bookings yet" detail="Create a booking to reserve inventory for a customer." />}
  </section>;
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    function onKeyDown(event) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><p className="eyebrow">RENTINGWALE WORKSPACE</p><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>{children}</section></div>;
}