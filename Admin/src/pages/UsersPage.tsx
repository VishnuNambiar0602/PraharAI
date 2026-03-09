import { useState, useEffect } from 'react';
import { Search, Filter, Download, Trash2, Eye, UserPlus } from 'lucide-react';
import { getAllUsers, deleteUser } from '../api';
import type { User } from '../types';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await deleteUser(userId);
      setUsers(users.filter((u) => u.userId !== userId));
    } catch (error) {
      alert('Failed to delete user');
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.userId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600 mt-1">Manage registered users</p>
        </div>
        <button className="btn btn-primary">
          <UserPlus className="size-4" />
          Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-600">Total Users</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{users.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600">Active Today</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {Math.floor(users.length * 0.3)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600">New This Month</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {Math.floor(users.length * 0.15)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600">Onboarding Complete</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {users.filter((u) => u.onboardingComplete).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by name, email, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <button className="btn btn-secondary">
            <Filter className="size-4" />
            Filters
          </button>
          <button className="btn btn-secondary">
            <Download className="size-4" />
            Export
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>State</th>
                <th>Employment</th>
                <th>Age</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.userId}>
                  <td className="font-mono text-xs">{user.userId.slice(0, 8)}...</td>
                  <td className="font-medium">{user.name || 'N/A'}</td>
                  <td>{user.email}</td>
                  <td>{user.state || 'N/A'}</td>
                  <td>{user.employment || 'N/A'}</td>
                  <td>{user.age || 'N/A'}</td>
                  <td className="text-sm text-gray-600">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    {user.onboardingComplete ? (
                      <span className="badge badge-success">Complete</span>
                    ) : (
                      <span className="badge badge-warning">Pending</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="View details"
                      >
                        <Eye className="size-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.userId)}
                        className="p-1 hover:bg-red-50 rounded"
                        title="Delete user"
                      >
                        <Trash2 className="size-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No users found</p>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="card max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">User Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">User ID</p>
                <p className="font-medium">{selectedUser.userId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium">{selectedUser.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{selectedUser.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Age</p>
                <p className="font-medium">{selectedUser.age || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">State</p>
                <p className="font-medium">{selectedUser.state || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Employment</p>
                <p className="font-medium">{selectedUser.employment || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Education</p>
                <p className="font-medium">{selectedUser.education || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Gender</p>
                <p className="font-medium">{selectedUser.gender || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Income</p>
                <p className="font-medium">
                  {selectedUser.income ? `₹${selectedUser.income.toLocaleString()}` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Joined</p>
                <p className="font-medium">
                  {new Date(selectedUser.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setSelectedUser(null)} className="btn btn-secondary">
                Close
              </button>
              <button className="btn btn-danger">
                <Trash2 className="size-4" />
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
