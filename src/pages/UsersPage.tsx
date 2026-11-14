import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { SortableHeader } from '../components/SortableHeader';
import type { SortState } from '../components/SortableHeader';
import { applySortInMemory } from '../utils/sort';
import { UserForm } from '../components/UserForm';
import type { UserResponseDTO, UserRequestDTO, UserUpdateDTO, UserRole } from '../types';
import { getInitials } from '../utils/format';

const ROLE_BADGE: Record<UserRole, { label: string; className: string }> = {
  ADMIN: { label: 'ADMIN', className: 'bg-primary-fixed text-on-primary-fixed-variant' },
  SELLER: { label: 'SELLER', className: 'bg-secondary-container text-on-secondary-container' },
};

export function UsersPage() {
  const { http } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserResponseDTO[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserResponseDTO | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function fetchUsers() {
    if (!http) return;
    setLoading(true);
    http
      .get<UserResponseDTO[]>('/users')
      .then((res) => setUsers(res.data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchUsers(); }, [http]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sort, setSort] = useState<SortState | null>(null);
  const adminCount = users.filter((u) => u.userRole === 'ADMIN').length;
  const sellerCount = users.filter((u) => u.userRole === 'SELLER').length;
  const sortedUsers = applySortInMemory(users, sort);

  async function handleCreate(data: UserRequestDTO | UserUpdateDTO) {
    await http!.post('/users', data);
    setShowForm(false);
    fetchUsers();
  }

  async function handleEdit(data: UserRequestDTO | UserUpdateDTO) {
    await http!.patch(`/users/${editing!.id}`, data);
    setEditing(undefined);
    setShowForm(false);
    fetchUsers();
  }

  async function handleDelete() {
    if (!http || !deleteTarget) return;
    await http.delete(`/users/${deleteTarget}`);
    fetchUsers();
  }

  function openEdit(u: UserResponseDTO) {
    setEditing(u);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(undefined);
  }

  return (
    <>
      <TopBar />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-h1 text-on-surface">Gerenciamento de Usuários</h1>
            <p className="text-body-lg text-on-surface-variant">
              Visualize e controle o acesso de todos os colaboradores do sistema.
            </p>
          </div>
          <button
            onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
          >
            <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
            Novo Usuário
          </button>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-fixed text-on-primary-fixed rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined">group</span>
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Total</p>
              <p className="text-h2 text-on-surface">{loading ? '—' : users.length}</p>
            </div>
          </div>
          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-secondary-container text-on-secondary-container rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined">admin_panel_settings</span>
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Admins</p>
              <p className="text-h2 text-on-surface">{loading ? '—' : adminCount}</p>
            </div>
          </div>
          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-tertiary-fixed text-on-tertiary-fixed rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined">sell</span>
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Vendedores</p>
              <p className="text-h2 text-on-surface">{loading ? '—' : sellerCount}</p>
            </div>
          </div>
          <div className="bg-on-secondary-fixed text-white rounded-xl p-5 shadow-lg shadow-primary/20 flex flex-col justify-center">
            <p className="text-sm font-bold opacity-80">Equipe Ativa</p>
            <div className="flex items-end gap-2 mt-1">
              <p className="text-h2">{loading ? '—' : users.length}</p>
              <span className="material-symbols-outlined mb-2 text-white/60">how_to_reg</span>
            </div>
            <p className="text-xs text-white/60 mt-1">colaboradores cadastrados</p>
          </div>
        </section>

        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high border-b border-outline-variant">
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase"><SortableHeader label="Nome Completo" field="firstName" sort={sort} onSort={setSort} defaultDir="asc" /></th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase"><SortableHeader label="Username" field="username" sort={sort} onSort={setSort} defaultDir="asc" /></th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase"><SortableHeader label="Email" field="email" sort={sort} onSort={setSort} defaultDir="asc" /></th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase"><SortableHeader label="Perfil" field="userRole" sort={sort} onSort={setSort} defaultDir="asc" /></th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant">
                      Carregando...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant">
                      Nenhum usuário cadastrado.
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map((u) => {
                    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ');
                    const badge = ROLE_BADGE[u.userRole];
                    return (
                      <tr key={u.id} className="hover:bg-surface-container transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {getInitials(fullName)}
                            </div>
                            <span className="font-bold text-on-surface">{fullName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-on-surface-variant">{u.username}</td>
                        <td className="px-6 py-4 text-on-surface-variant">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-label-sm font-bold uppercase ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(u)}
                              className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                              title="Editar"
                            >
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(u.id)}
                              className="p-2 text-error hover:bg-error/10 rounded-lg"
                              title="Excluir"
                            >
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-low">
            <p className="text-sm text-on-surface-variant">
              {loading ? '—' : `Exibindo ${users.length} usuário${users.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </section>
      </div>

      <Modal
        open={showForm}
        onClose={closeForm}
        title={editing ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}
        maxWidth="max-w-lg"
      >
        <UserForm
          initial={editing}
          onSubmit={editing ? handleEdit : handleCreate}
          onClose={closeForm}
        />
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Excluir Usuário"
        message="Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
