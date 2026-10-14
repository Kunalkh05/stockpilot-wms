import React, { useState, useEffect } from 'react';
import { Users, Plus, RefreshCw, Shield, Mail, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useWarehouse } from '../context/WarehouseContext.js';
import { api } from '../services/api.js';
import { User, Role } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { toast } from 'sonner';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { warehouses } = useWarehouse();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create User Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('WAREHOUSE_MANAGER');
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err) {
      toast.error('Failed to load user accounts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createUser({
        email,
        fullName,
        password,
        role,
        warehouseIds: selectedWarehouses,
      });
      toast.success('User account created successfully');
      setIsCreateOpen(false);
      setEmail('');
      setFullName('');
      setPassword('');
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">
            User Accounts & Role Permissions
          </h1>
          <p className="text-xs text-surface-500">
            Server-enforced RBAC access management for warehouse personnel
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadUsers} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          {currentUser?.role === 'ADMIN' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add User
            </Button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-surface-200 rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full min-w-[700px] text-left text-xs">
          <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
            <tr>
              <th className="px-4 py-2.5">User</th>
              <th className="px-4 py-2.5">Email Address</th>
              <th className="px-4 py-2.5">Role Authorization</th>
              <th className="px-4 py-2.5">Facility Memberships</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 font-sans">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-surface-400">
                  Loading users...
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-surface-100 border border-surface-200 flex items-center justify-center font-mono font-bold text-surface-700 text-xs">
                        {u.fullName.charAt(0)}
                      </div>
                      <span className="font-semibold text-surface-900">{u.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-surface-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        u.role === 'ADMIN'
                          ? 'amber'
                          : u.role === 'WAREHOUSE_MANAGER'
                          ? 'info'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {u.role.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-surface-500 text-[11px]">
                    {u.memberships?.map((m) => m.warehouse?.code).join(', ') || 'All Facilities'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 font-mono text-emerald-700 font-medium text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ACTIVE
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Warehouse Operative User"
        description="Provision user credentials with server-enforced RBAC privileges"
      >
        <form onSubmit={handleCreateUser} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rajesh Kumar"
              className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
              Corporate Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@stockpilot.io"
              className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
              Initial Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
              Assigned Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full h-8 px-2 text-xs border border-surface-300 rounded bg-white"
            >
              <option value="ADMIN">Admin (Full System Privilege)</option>
              <option value="WAREHOUSE_MANAGER">Warehouse Manager (Transfers, Adjustments, Approvals)</option>
              <option value="INVENTORY_SPECIALIST">Inventory Specialist (Catalog, Movements, Orders)</option>
              <option value="PICKER_PACKER">Picker / Packer (Fulfillment Picking & Shipping)</option>
              <option value="RECEIVING_CLERK">Receiving Clerk (Dock Receiving & Put-Away)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Create User Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
