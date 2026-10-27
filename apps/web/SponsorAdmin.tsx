"use client";

import { useEffect, useState } from "react";

type Order = {
  id: string; plan_code: string; amount_usdc: number; minimum_placements: number;
  sponsor_name: string; title: string; description: string; url: string;
  contact: string; status: string; created_at: string;
  sponsor_placements?: { count: number }[];
};

export default function SponsorAdmin({ active }: { active: boolean }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  async function load() {
    if (!active) return setOrders([]);
    const response = await fetch("/api/admin/sponsors");
    const result = await response.json().catch(() => ({}));
    if (result.success) setOrders(result.orders ?? []);
  }
  useEffect(() => { void load(); }, [active]);
  async function setStatus(id: string, status: string) {
    const response = await fetch("/api/admin/sponsors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    const result = await response.json().catch(() => ({}));
    setMessage(result.message ?? "");
    if (result.success) void load();
  }
  if (!active) return null;
  return (
    <section className="admin-list sponsor-admin">
      <div className="growth-section-heading"><div><span className="eyebrow">Paid inventory</span><h2>Sponsor packages</h2></div><button className="ghost-button" onClick={() => void load()}>Refresh</button></div>
      {message && <p className="form-message">{message}</p>}
      {orders.length === 0 ? <div className="admin-empty"><p>No sponsor orders yet.</p></div> : orders.map((order) => (
        <article className="admin-review-card" key={order.id}>
          <div><span className={`status-pill ${order.status}`}>{order.status}</span><h3>{order.sponsor_name} · {order.title}</h3><p>{order.description}</p><a href={order.url} target="_blank" rel="noreferrer">Review destination</a><p className="hint">{order.plan_code} · {order.amount_usdc} USDC · delivered {order.sponsor_placements?.[0]?.count ?? 0}/{order.minimum_placements} · {order.contact}</p></div>
          <div className="admin-action-buttons"><button className="primary-button" onClick={() => void setStatus(order.id, "active")}>Approve + activate</button><button className="ghost-button" onClick={() => void setStatus(order.id, "paused")}>Pause</button><button className="ghost-button danger-button" onClick={() => void setStatus(order.id, "rejected")}>Reject</button></div>
        </article>
      ))}
    </section>
  );
}
