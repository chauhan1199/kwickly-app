import React from 'react';
import { Loader } from 'lucide-react';

export default function Button({ children, onClick, variant = 'primary', size = 'md', className = '', style = {}, disabled = false, loading = false, icon: Icon, type = 'button' }) {
  const baseClass = 'btn';
  const variantClass = variant === 'primary' ? 'btn-primary' : variant === 'outline' ? 'btn-outline' : variant === 'danger' ? 'btn-danger' : variant === 'success' ? 'btn-success' : 'btn-secondary';
  const sizeStyle = size === 'sm' ? { padding: '6px 12px', fontSize: 13 } : size === 'lg' ? { padding: '12px 24px', fontSize: 16 } : { padding: '8px 16px', fontSize: 14 };

  return (
    <button
      type={type}
      className={`${baseClass} ${variantClass} ${className}`}
      style={{ ...sizeStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...style }}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? <Loader className="spin" size={16} /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}
