import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronDownIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    AssetIcon,
    BanknotesIcon,
    EquityIcon,
    IncomeIcon,
    ExpenseIcon
} from './icons';
import { CHART_OF_ACCOUNTS } from '../services/geminiService';

export const getChildCategory = (category: string) => {
    if (!category) return '';
    const parts = category.split('|');
    return parts[parts.length - 1].trim();
};

interface CategoryDropdownProps {
    value: string;
    onChange: (val: string) => void;
    customCategories: string[];
    placeholder?: string;
    className?: string;
    showAllOption?: boolean;
}

export const CategoryDropdown = ({
    value,
    onChange,
    customCategories,
    placeholder = "Select Category...",
    className = "",
    showAllOption = false
}: CategoryDropdownProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Calculate position when opening
    useEffect(() => {
        if (isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            setMenuStyle({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
            setSearchTerm('');

            // Focus search input after render
            setTimeout(() => {
                if (searchInputRef.current) searchInputRef.current.focus();
            }, 50);
        }
    }, [isOpen]);

    // Handle clicking outside - slightly modified for Portal
    useEffect(() => {
        const handleMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;
            // Check if click is inside dropdown button
            if (dropdownRef.current && dropdownRef.current.contains(target)) {
                return;
            }
            // Check if click is inside the portal menu (we need a way to identify it)
            const portalMenu = document.getElementById('category-dropdown-portal-menu');
            if (portalMenu && portalMenu.contains(target)) {
                return;
            }
            setIsOpen(false);
        };

        // Close on scroll or resize to prevent floating menu issues
        const handleScrollOrResize = (event: Event) => {
            if (isOpen) {
                const target = event.target as Node;
                const portalMenu = document.getElementById('category-dropdown-portal-menu');
                if (portalMenu && portalMenu.contains(target)) {
                    return;
                }
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('scroll', handleScrollOrResize, true); // Capture phase for all scrolling elements
        window.addEventListener('resize', handleScrollOrResize);

        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [isOpen]);

    const matchesSearch = (text: string) => text.toLowerCase().includes(searchTerm.toLowerCase());

    const isUncategorized = (value === 'UNCATEGORIZED' || (value && value.toLowerCase().includes('uncategorized'))) && value !== 'ALL';
    const currentLabel = value === 'ALL' ? 'All Categories' : (isUncategorized ? 'Uncategorized' : getChildCategory(value) || placeholder);

    const menuContent = (
        <div
            id="category-dropdown-portal-menu"
            className="absolute z-[9999] mt-1 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150"
            style={{
                top: menuStyle?.top,
                left: menuStyle?.left,
                width: Math.max(menuStyle?.width || 260, 260)
            }}
        >
            <div className="p-2 border-b border-border bg-card sticky top-0 z-10">
                <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="w-full bg-muted/50 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground transition-all"
                        placeholder="Search category..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            </div>

            <div className="max-h-[320px] overflow-y-auto custom-scrollbar overflow-x-hidden">
                {/* Static Actions */}
                <div className="p-1 space-y-0.5">
                    {showAllOption && matchesSearch('All Categories') && (
                        <button
                            type="button"
                            onClick={() => { onChange('ALL'); setIsOpen(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-primary rounded-lg text-[11px] text-primary font-bold transition-colors"
                        >
                            All Categories
                        </button>
                    )}
                    {matchesSearch('Uncategorized') && (
                        <button
                            type="button"
                            onClick={() => { onChange('UNCATEGORIZED'); setIsOpen(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-primary rounded-lg text-[11px] text-destructive font-bold italic transition-colors"
                        >
                            Uncategorized
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => { onChange('__NEW__'); setIsOpen(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-primary rounded-lg text-[11px] text-primary font-bold transition-colors flex items-center gap-2"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        Add New Category
                    </button>
                </div>

                <div className="h-px bg-border my-1 mx-2" />

                {/* Chart of Accounts */}
                <div className="p-1 pb-4">
                    {Object.entries(CHART_OF_ACCOUNTS).map(([mainCategory, sub]) => {
                        const relatedCustom = customCategories.filter(c => c.startsWith(`${mainCategory} |`) && matchesSearch(c));
                        const standardOptions: string[] = [];

                        if (Array.isArray(sub)) {
                            sub.forEach(item => standardOptions.push(`${mainCategory} | ${item}`));
                        } else if (typeof sub === 'object') {
                            Object.entries(sub).forEach(([subGroup, items]) =>
                                (items as string[]).forEach(item => standardOptions.push(`${mainCategory} | ${subGroup} | ${item}`))
                            );
                        }

                        const visibleStandard = standardOptions.filter(c => matchesSearch(c));

                        if (relatedCustom.length === 0 && visibleStandard.length === 0) return null;

                        return (
                            <div key={mainCategory} className="mt-2">
                                <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-foreground flex items-center gap-2 opacity-80">
                                    {mainCategory === 'Assets' && <AssetIcon className="w-3.5 h-3.5" />}
                                    {mainCategory === 'Liabilities' && <BanknotesIcon className="w-3.5 h-3.5" />}
                                    {mainCategory === 'Equity' && <EquityIcon className="w-3.5 h-3.5" />}
                                    {mainCategory === 'Income' && <IncomeIcon className="w-3.5 h-3.5" />}
                                    {mainCategory === 'Expenses' && <ExpenseIcon className="w-3.5 h-3.5" />}
                                    {mainCategory}
                                </div>

                                <div className="space-y-0.5">
                                    {relatedCustom.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => { onChange(c); setIsOpen(false); }}
                                            className={`w-full text-left px-8 py-1.5 hover:bg-primary rounded-lg text-[11px] transition-colors ${value === c ? 'bg-primary text-primary-foreground font-bold' : 'text-primary'}`}
                                        >
                                            {getChildCategory(c)} (Custom)
                                        </button>
                                    ))}

                                    {visibleStandard.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => { onChange(c); setIsOpen(false); }}
                                            className={`w-full text-left px-8 py-1.5 hover:bg-primary rounded-lg text-[11px] transition-colors ${value === c ? 'bg-primary text-primary-foreground font-bold' : 'text-foreground/70'}`}
                                        >
                                            {getChildCategory(c)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Handle orphan custom categories */}
                    {(() => {
                        const orphans = customCategories.filter(c => !Object.keys(CHART_OF_ACCOUNTS).some(root => c.startsWith(`${root} |`)) && matchesSearch(c));
                        if (orphans.length === 0) return null;
                        return (
                            <div className="mt-2">
                                <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-foreground flex items-center gap-2 opacity-80">
                                    Others
                                </div>
                                <div className="space-y-0.5">
                                    {orphans.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => { onChange(c); setIsOpen(false); }}
                                            className={`w-full text-left px-8 py-1.5 hover:bg-primary rounded-lg text-[11px] transition-colors ${value === c ? 'bg-primary text-primary-foreground font-bold' : 'text-primary'}`}
                                        >
                                            {getChildCategory(c)} (Custom)
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/50 border ${isUncategorized ? 'border-destructive/30' : (value === 'ALL' ? 'border-primary/30' : 'border-border')} rounded-lg hover:border-primary/50 transition-all text-left outline-none min-h-[32px]`}
            >
                <span className={`text-[11px] truncate ${isUncategorized ? 'text-destructive font-bold italic' : (value === 'ALL' ? 'text-primary font-bold' : 'text-foreground')}`}>
                    {currentLabel}
                </span>
                <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : 'text-muted-foreground'}`} />
            </button>

            {isOpen && createPortal(menuContent, document.body)}
        </div>
    );
};
