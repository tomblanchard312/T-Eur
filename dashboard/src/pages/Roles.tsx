import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teurApi } from '../lib/api';

const Roles = () => {
  const [checkData, setCheckData] = useState({ role: '', account: '' });
  const [grantData, setGrantData] = useState({ role: '', account: '' });
  const [revokeData, setRevokeData] = useState({ role: '', account: '' });

  const { data: roles } = useQuery({
    queryKey: ['available-roles'],
    queryFn: teurApi.getAvailableRoles,
  });

  const { data: hasRole, refetch: refetchCheck } = useQuery({
    queryKey: ['check-role', checkData.role, checkData.account],
    queryFn: () => teurApi.checkRole(checkData.role, checkData.account),
    enabled: !!checkData.role && !!checkData.account,
  });

  const handleCheck = () => {
    if (checkData.role && checkData.account) refetchCheck();
  };

  const handleGrant = async () => {
    try {
      await teurApi.grantRole(grantData);
      alert('Role granted successfully');
    } catch (error) {
      alert('Error granting role');
    }
  };

  const handleRevoke = async () => {
    try {
      await teurApi.revokeRole(revokeData);
      alert('Role revoked successfully');
    } catch (error) {
      alert('Error revoking role');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Roles</h1>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Available Roles</h2>
        {roles ? (
          <ul>
            {roles.map((role: string) => (
              <li key={role}>{role}</li>
            ))}
          </ul>
        ) : (
          <p>Loading...</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Check Role */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Check Role</h2>
          <input
            type="text"
            placeholder="Role"
            value={checkData.role}
            onChange={(e) => setCheckData({ ...checkData, role: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="text"
            placeholder="Account"
            value={checkData.account}
            onChange={(e) => setCheckData({ ...checkData, account: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <button onClick={handleCheck} className="bg-blue-500 text-white px-4 py-2 rounded">
            Check
          </button>
          {hasRole !== undefined && (
            <p className="mt-2">Has Role: {hasRole ? 'Yes' : 'No'}</p>
          )}
        </div>

        {/* Grant Role */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Grant Role</h2>
          <input
            type="text"
            placeholder="Role"
            value={grantData.role}
            onChange={(e) => setGrantData({ ...grantData, role: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="text"
            placeholder="Account"
            value={grantData.account}
            onChange={(e) => setGrantData({ ...grantData, account: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <button onClick={handleGrant} className="bg-green-500 text-white px-4 py-2 rounded">
            Grant
          </button>
        </div>

        {/* Revoke Role */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Revoke Role</h2>
          <input
            type="text"
            placeholder="Role"
            value={revokeData.role}
            onChange={(e) => setRevokeData({ ...revokeData, role: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="text"
            placeholder="Account"
            value={revokeData.account}
            onChange={(e) => setRevokeData({ ...revokeData, account: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <button onClick={handleRevoke} className="bg-red-500 text-white px-4 py-2 rounded">
            Revoke
          </button>
        </div>
      </div>
    </div>
  );
};

export default Roles;