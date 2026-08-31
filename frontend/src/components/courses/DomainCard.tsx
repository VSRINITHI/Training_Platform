import React from 'react';
import { Link } from 'react-router-dom';
import { Folder, ArrowRight } from 'lucide-react';
import { Domain } from '../../types';

interface DomainCardProps {
  domain: Domain;
  isSelected?: boolean;
  onSelect?: () => void;
}

export const DomainCard: React.FC<DomainCardProps> = ({ domain, isSelected, onSelect }) => {
  const subCount = domain.sub_domains?.length || 0;

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`p-4 rounded-xl border text-left transition-all w-full flex flex-col justify-between ${
          isSelected
            ? 'border-primary bg-primary-light/50 ring-2 ring-primary shadow-sm'
            : 'border-border bg-white hover:border-slate-300 hover:shadow-card'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}>
            <Folder className="w-5 h-5" />
          </div>
          {isSelected && (
            <span className="text-xs font-bold text-primary px-2 py-0.5 rounded bg-white">Selected</span>
          )}
        </div>
        <div>
          <h4 className="text-sm font-bold text-charcoal">{domain.name}</h4>
          {domain.description && (
            <p className="text-xs text-charcoal-muted line-clamp-2 mt-1">{domain.description}</p>
          )}
        </div>
      </button>
    );
  }

  return (
    <Link
      to={`/learner/discover?domain=${domain.id}`}
      className="p-5 rounded-xl border border-border bg-white shadow-card hover:shadow-card-hover hover:border-primary/50 transition-all flex flex-col justify-between group"
    >
      <div>
        <div className="p-2.5 bg-indigo-50 text-primary rounded-xl w-fit mb-3 group-hover:bg-primary group-hover:text-white transition-colors">
          <Folder className="w-5 h-5" />
        </div>
        <h4 className="text-base font-bold text-charcoal group-hover:text-primary transition-colors">
          {domain.name}
        </h4>
        {domain.description && (
          <p className="text-xs text-charcoal-muted line-clamp-2 mt-1">{domain.description}</p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-charcoal-muted group-hover:text-primary">
        <span>{subCount} sub-domains</span>
        <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
};
