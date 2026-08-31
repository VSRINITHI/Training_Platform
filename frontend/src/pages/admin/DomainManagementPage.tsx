import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderTree, Plus, Edit, Trash2, Search, ArrowRight } from 'lucide-react';
import { domainsApi } from '../../api/domains';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { Domain } from '../../types';

export const DomainManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [domainToDelete, setDomainToDelete] = useState<Domain | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');

  const { data: domains = [], isLoading } = useQuery({
    queryKey: ['admin-domains-list'],
    queryFn: domainsApi.list,
  });

  const openCreateModal = () => {
    setEditingDomain(null);
    setName('');
    setSlug('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (d: Domain) => {
    setEditingDomain(d);
    setName(d.name);
    setSlug(d.slug);
    setDescription(d.description || '');
    setIsModalOpen(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!editingDomain) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')
      );
    }
  };

  // Save / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingDomain) {
        return domainsApi.update(editingDomain.id, {
          name,
          slug,
          description: description || undefined,
        });
      } else {
        return domainsApi.create({
          name,
          slug,
          description: description || undefined,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-domains-list'] });
      success(editingDomain ? 'Domain Updated' : 'Domain Created', 'Subject domain saved successfully.');
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toastError('Action Failed', err.message);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => domainsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-domains-list'] });
      success('Domain Deleted', 'The subject domain has been removed.');
      setDomainToDelete(null);
    },
    onError: (err: any) => {
      toastError('Delete Failed', err.message);
    },
  });

  const filteredDomains = domains.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Domain Taxonomy Management"
        description="Configure top-level academic and technical subject domains."
        actions={
          <Button size="md" onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
            Add Domain
          </Button>
        }
      />

      {/* Search Input */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-card">
        <Input
          placeholder="Search domains by name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Domains Table */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-charcoal-muted">
                <tr>
                  <th className="px-6 py-3.5">Domain Name</th>
                  <th className="px-6 py-3.5">Slug</th>
                  <th className="px-6 py-3.5">Sub-Domains</th>
                  <th className="px-6 py-3.5">Description</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-charcoal">
                {filteredDomains.map((domain) => (
                  <tr key={domain.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold">{domain.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-charcoal-muted">{domain.slug}</td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-primary">
                        {domain.sub_domains?.length || 0} sub-domains
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-charcoal-muted max-w-xs truncate">
                      {domain.description || '—'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(domain)}
                        className="p-1.5 text-slate-400 hover:text-primary rounded hover:bg-slate-100"
                        title="Edit Domain"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDomainToDelete(domain)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                        title="Delete Domain"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDomain ? 'Edit Domain' : 'Create Subject Domain'}
        description="Top-level taxonomy categories organize all technical tracks."
      >
        <div className="space-y-4">
          <Input
            label="Domain Name"
            placeholder="e.g. Technology & Engineering"
            value={name}
            onChange={handleNameChange}
          />

          <Input
            label="URL Slug"
            placeholder="e.g. technology"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />

          <Textarea
            label="Description (Optional)"
            placeholder="Overview of this subject domain..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="pt-4 border-t border-border flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              isLoading={saveMutation.isPending}
              disabled={!name.trim() || !slug.trim()}
            >
              {editingDomain ? 'Save Changes' : 'Create Domain'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      {domainToDelete && (
        <ConfirmDialog
          isOpen={Boolean(domainToDelete)}
          onClose={() => setDomainToDelete(null)}
          onConfirm={() => deleteMutation.mutate(domainToDelete.id)}
          title="Delete Domain"
          message={`Are you sure you want to delete "${domainToDelete.name}"? This action cannot be undone.`}
          confirmLabel="Delete Domain"
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
};
