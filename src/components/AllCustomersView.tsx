import { useEffect, useState } from 'react';
import { CheckCircle2, Plus, Search, Users } from 'lucide-react';
import { clinicApi } from '../api/clinicApi.ts';
import type { CustomerSummary } from '../types/clinic.ts';

interface AllCustomersViewProps {
  onRegisterPetForCustomer: (customerId: number) => void;
  refreshKey: number;
}

export function AllCustomersView({
  onRegisterPetForCustomer,
  refreshKey,
}: AllCustomersViewProps) {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    clinicApi
      .getCustomers()
      .then(setCustomers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.phone_number.includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            All Registered Customers
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Verified Pet Owner accounts linked to Pawsitive Care Veterinary Clinic.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">User ID</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Mobile Number</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4 text-right">Linked Pets</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-slate-500">
                    Loading registered customers...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center text-slate-500 space-y-2">
                    <Users className="w-7 h-7 text-slate-400 mx-auto" />
                    <div>No verified Pet Owner accounts found yet.</div>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.user_id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      #{c.user_id}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{c.full_name}</td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-700">
                      {c.phone_number}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{c.email || '—'}</td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified OTP
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-slate-800">
                      {c.pet_count}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => onRegisterPetForCustomer(c.user_id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-md"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Register Pet
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
