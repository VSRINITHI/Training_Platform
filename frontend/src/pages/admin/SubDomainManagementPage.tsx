import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tags, Plus, Edit, Trash2, Search, ArrowRight } from 'lucide-react';
import { domainsApi } from '../../api/domains';
import { subDomainsApi } from '../../api/subDomains';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { SubDomain } from '../../types';

export const SubDomainManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubDomain, setEditingSubDomain] = useState<SubDomain | null>(null);

  const [domainId, setDomainId] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [subDomainToDelete, setSubDomainToDelete] = useState<SubDomain | null>(null);

  // Fetch Parent Domains
  const { data: domains = [] } = useQuery({
    queryKey: ['admin-parent-domains'],
    queryFn: domainsApi.list,
  });

  // Fetch Sub-Domains
  const { data: subDomains = [], isLoading } = useQuery({
    queryKey: ['admin-subdomains-list', selectedDomainId],
    queryFn: () => subDomainsApi.list(selectedDomainId || undefined),
  });

  const openCreateModal = () => {
    setEditingSubDomain(null);
    setDomainId(selectedDomainId || (domains.length > 0 ? domains[0].id : ''));
    setName('');
    setSlug('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (sd: SubDomain) => {
    setEditingSubDomain(sd);
    setDomainId(sd.domain_id);
    setName(sd.name);
    setSlug(sd.slug);
    setDescription(sd.description || '');
    setIsModalOpen(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!editingSubDomain) {
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
      if (editingSubDomain) {
        return subDomainsApi.update(editingSubDomain.id, {
          name,
          slug,
          description: description || undefined,
        });
      } else {
        return subDomainsApi.create({
          domain_id: domainId,
          name,
          slug,
          description: description || undefined,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subdomains-list'] });
      success(editingSubDomain ? 'Sub-Domain Updated' : 'Sub-Domain Created', 'Topic saved successfully.');
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toastError('Action Failed', err.message);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => subDomainsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subdomains-list'] });
      success('Sub-Domain Deleted', 'Technical topic removed.');
      setSubDomainToDelete(null);
    },
    onError: (err: any) => {
      toastError('Delete Failed', err.message);
    },
  });

  const filteredSubDomains = subDomains.filter(
    (sd) =>
      sd.name.toLowerCase().includes(search.toLowerCase()) ||
      sd.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sub-Domain & Topic Management"
        description="Configure technical sub-domains and learning specializations within parent domains."
        actions={
          <Button size="md" onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
            Add Sub-Domain
          </Button>
        }
      />

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-card grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          value={selectedDomainId}
          onChange={(e) => setSelectedDomainId(e.target.value)}
          placeholder="Filter by Parent Domain"
        >
          <option value="">All Parent Domains</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>

        <SearchInput
          placeholder="Search sub-domains by name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      {/* Sub-Domains Table */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : filteredSubDomains.length === 0 ? (
        <EmptyState
          title={search || selectedDomainId ? 'No Matching Sub-Domains' : 'No Sub-Domains Created'}
          description={
            search || selectedDomainId
              ? `No sub-domains matched your filter or search criteria.`
              : 'Add your first technical sub-domain topic.'
          }
          actionLabel={search || selectedDomainId ? 'Clear Filters' : 'Add Sub-Domain'}
          onAction={
            search || selectedDomainId
              ? () => {
                  setSearch('');
                  setSelectedDomainId('');
                }
              : openCreateModal
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-charcoal-muted">
                <tr>
                  <th className="px-6 py-3.5">Topic / Sub-Domain</th>
                  <th className="px-6 py-3.5">Parent Domain</th>
                  <th className="px-6 py-3.5">Slug</th>
                  <th className="px-6 py-3.5">Published Courses</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-charcoal">
                {filteredSubDomains.map((sd) => (
                  <tr key={sd.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold">{sd.name}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-primary">
                      {sd.domain?.name || '—'}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-charcoal-muted">{sd.slug}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-charcoal">
                      {sd.published_course_count ?? 0} courses
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(sd)}
                        className="p-1.5 text-slate-400 hover:text-primary rounded hover:bg-slate-100"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setSubDomainToDelete(sd)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                        title="Delete"
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

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSubDomain ? 'Edit Sub-Domain' : 'Add Technical Sub-Domain'}
        description="Technical topics group specific courses and competency tracks."
      >
        <div className="space-y-4">
          {!editingSubDomain && (
            <Select
              label="Parent Domain"
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          )}

          <Input
            label="Sub-Domain / Topic Name"
            placeholder="e.g. Python Programming"
            value={name}
            onChange={handleNameChange}
          />

          <Input
            label="URL Slug"
            placeholder="e.g. python-programming"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />

          <Textarea
            label="Description (Optional)"
            placeholder="Overview of this technical specialisation..."
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
              {editingSubDomain ? 'Save Changes' : 'Create Sub-Domain'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      {subDomainToDelete && (
        <ConfirmDialog
          isOpen={Boolean(subDomainToDelete)}
          onClose={() => setSubDomainToDelete(null)}
          onConfirm={() => deleteMutation.mutate(subDomainToDelete.id)}
          title="Delete Sub-Domain"
          message={`Are you sure you want to delete "${subDomainToDelete.name}"?`}
          confirmLabel="Delete"
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
};
