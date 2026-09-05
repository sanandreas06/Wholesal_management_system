'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

interface Contact { id: string; name: string; role: string | null; phone: string | null; email: string | null }
interface Supplier {
  id: string; name: string; code: string; phone: string | null; email: string | null; address: string | null;
  creditLimit: string | number | null; creditDays: number | null; status: "ACTIVE" | "INACTIVE"; contacts: Contact[];
}

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

export default function SuppliersManager() {
  const [items, setItems] = useState<Supplier[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [managingContacts, setManagingContacts] = useState<Supplier | null>(null);
  const [canCreate, canUpdate, canDelete] = usePermissions("SUPPLIERS:CREATE", "SUPPLIERS:UPDATE", "SUPPLIERS:DELETE");

  function load() { api.get<Supplier[]>("/suppliers").then(setItems).catch(e => setError(e.message)); }
  useEffect(load, []);

  async function remove(item: Supplier) {
    if (!confirm(`Delete supplier "${item.name}"?`)) return;
    try { await api.delete(`/suppliers/${item.id}`); load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Delete failed"); }
  }

  return (
    <AppShell title="Suppliers">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{items ? `${items.length} supplier${items.length === 1 ? "" : "s"}` : "Loading..."}</p>
        {canCreate && <button onClick={() => setEditing("new")}>+ New Supplier</button>}
      </div>
      <div className="table-wrap">
        {items && items.length === 0 && <div className="empty">No suppliers yet.</div>}
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
      {editing && <SupplierModal item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {managingContacts && <ContactsModal parentType="suppliers" parent={managingContacts} onClose={() => setManagingContacts(null)} onSaved={() => { setManagingContacts(null); load(); }} />}
    </AppShell>
  );
}

function SupplierModal({ item, onClose, onSaved }: { item: Supplier | null; onClose: () => void; onSaved: () => void }) {
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
      if (item) await api.put(`/suppliers/${item.id}`, payload);
      else await api.post("/suppliers", payload);
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{item ? "Edit Supplier" : "New Supplier"}</h2>
        <form onSubmit={submit}>
          <label>Name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Golden Star Foods Ltd" required /></label>
          <label>Code<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. GSF" required /></label>
          <label>Phone<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 0244 000 000" /></label>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. sales@supplier.com" /></label>
          <label>Address<input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Industrial Area, Kumasi" /></label>
          <label>Credit Limit (GHS)<input type="number" step="0.01" min="0" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} placeholder="e.g. 50000" /></label>
          <label>Credit Days<input type="number" min="0" value={creditDays} onChange={e => setCreditDays(e.target.value)} placeholder="e.g. 30" /></label>
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

export function ContactsModal({ parentType, parent, onClose, onSaved }: {
  parentType: "suppliers" | "customers"; parent: { id: string; name: string; contacts: Contact[] }; onClose: () => void; onSaved: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>(parent.contacts);
  const [showForm, setShowForm] = useState(parent.contacts.length === 0);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function addContact(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const created = await api.post<Contact>(`/${parentType}/${parent.id}/contacts`, { name, role: role || undefined, phone: phone || undefined, email: email || undefined });
      setContacts(prev => [...prev, created]);
      setName(""); setRole(""); setPhone(""); setEmail("");
      setShowForm(false);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Add failed"); }
    finally { setSaving(false); }
  }

  async function removeContact(contactId: string) {
    if (!confirm("Remove this contact?")) return;
    try { await api.delete(`/${parentType}/${parent.id}/contacts/${contactId}`); setContacts(prev => prev.filter(c => c.id !== contactId)); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Remove failed"); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>Contacts for {parent.name}</h2>

        {contacts.length === 0 && !showForm && <p className="muted">No contacts yet.</p>}

        {contacts.length > 0 && (
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table>
              <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th></th></tr></thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id}>
                    <td>{c.name}</td><td>{c.role || "—"}</td><td>{c.phone || "—"}</td>
                    <td className="row-actions"><button className="secondary" onClick={() => removeContact(c.id)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!showForm && (
          <div className="modal-actions" style={{ justifyContent: "space-between" }}>
            <button type="button" className="secondary" onClick={onClose}>Done</button>
            <button type="button" onClick={() => setShowForm(true)}>+ Add Contact</button>
          </div>
        )}

        {showForm && (
          <form onSubmit={addContact}>
            <label>Name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kwame Mensah" required /></label>
            <label>Role<input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Sales Rep, Accounts" /></label>
            <label>Phone<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 0244 000 000" /></label>
            <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. contact@supplier.com" /></label>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => { setShowForm(false); setError(""); }}>
                {contacts.length === 0 ? "Cancel" : "Back to list"}
              </button>
              <button disabled={saving}>{saving ? "Adding..." : "Save Contact"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
