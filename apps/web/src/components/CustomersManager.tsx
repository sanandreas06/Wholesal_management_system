'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";
import { ContactsModal } from "./SuppliersManager";

interface Contact { id: string; name: string; role: string | null; phone: string | null; email: string | null }
interface Customer {
  id: string; name: string; code: string; phone: string | null; email: string | null; address: string | null;
  creditLimit: string | number | null; creditDays: number | null; status: "ACTIVE" | "INACTIVE"; contacts: Contact[];
}

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

export default function CustomersManager() {
  const [items, setItems] = useState<Customer[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [managingContacts, setManagingContacts] = useState<Customer | null>(null);
  const [canCreate, canUpdate, canDelete] = usePermissions("CUSTOMERS:CREATE", "CUSTOMERS:UPDATE", "CUSTOMERS:DELETE");

  function load() { api.get<Customer[]>("/customers").then(setItems).catch(e => setError(e.message)); }
  useEffect(load, []);

  async function remove(item: Customer) {
    if (!confirm(`Delete customer "${item.name}"?`)) return;
    try { await api.delete(`/customers/${item.id}`); load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Delete failed"); }
  }

  return (
    <AppShell title="Customers">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{items ? `${items.length} customer${items.length === 1 ? "" : "s"}` : "Loading..."}</p>
        {canCreate && <button onClick={() => setEditing("new")}>+ New Customer</button>}
      </div>
      <div className="table-wrap">
        {items && items.length === 0 && <div className="empty">No customers yet.</div>}
        {items && items.length > 0 && (
          <table>
            <thead><tr><th>Name</th><th>Code</th><th>Phone</th><th>Credit Limit</th><th>Contacts</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>{i.code}</td>
                  <td>{i.phone || "—"}</td>
                  <td>{i.creditLimit != null ? money.format(Number(i.creditLimit)) : "—"}</td>
                  <td>{i.contacts.length}</td>
                  <td><span className={`badge ${i.status === "ACTIVE" ? "active" : "inactive"}`}>{i.status}</span></td>
                  <td className="row-actions">
                    {canUpdate && <button className="secondary" onClick={() => setEditing(i)}>Edit</button>}
                    {canUpdate && <button className="secondary" onClick={() => setManagingContacts(i)}>Contacts</button>}
                    {canDelete && <button className="secondary" onClick={() => remove(i)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && <CustomerModal item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {managingContacts && <ContactsModal parentType="customers" parent={managingContacts} onClose={() => setManagingContacts(null)} onSaved={() => { setManagingContacts(null); load(); }} />}
    </AppShell>
  );
}

function CustomerModal({ item, onClose, onSaved }: { item: Customer | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name || "");
  const [code, setCode] = useState(item?.code || "");
  const [phone, setPhone] = useState(item?.phone || "");
  const [email, setEmail] = useState(item?.email || "");
  const [address, setAddress] = useState(item?.address || "");
  const [creditLimit, setCreditLimit] = useState(item?.creditLimit != null ? String(item.creditLimit) : "");
  const [creditDays, setCreditDays] = useState(item?.creditDays != null ? String(item.creditDays) : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const payload = {
      name, code, phone: phone || undefined, email: email || undefined, address: address || undefined,
      creditLimit: creditLimit ? Number(creditLimit) : undefined, creditDays: creditDays ? Number(creditDays) : undefined
    };
    try {
      if (item) await api.put(`/customers/${item.id}`, payload);
      else await api.post("/customers", payload);
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{item ? "Edit Customer" : "New Customer"}</h2>
        <form onSubmit={submit}>
          <label>Name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Adom Wholesale Stores" required /></label>
          <label>Code<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. ADOM" required /></label>
          <label>Phone<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 0244 000 000" /></label>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. orders@customer.com" /></label>
          <label>Address<input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Adum, Kumasi" /></label>
          <label>Credit Limit (GHS)<input type="number" step="0.01" min="0" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} placeholder="e.g. 20000" /></label>
          <label>Credit Days<input type="number" min="0" value={creditDays} onChange={e => setCreditDays(e.target.value)} placeholder="e.g. 14" /></label>
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
