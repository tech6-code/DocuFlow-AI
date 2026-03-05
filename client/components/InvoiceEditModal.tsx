
import React, { useState, useEffect } from 'react';
import type { Invoice, LineItem } from '../types';
import { PencilIcon, XMarkIcon, TrashIcon, PlusIcon } from './icons';

interface InvoiceEditModalProps {
    invoice: Invoice;
    onSave: (invoice: Invoice) => void;
    onClose: () => void;
}

export const InvoiceEditModal: React.FC<InvoiceEditModalProps> = ({ invoice, onSave, onClose }) => {
    const [editedInvoice, setEditedInvoice] = useState<Invoice>(JSON.parse(JSON.stringify(invoice))); // Deep copy to prevent mutation issues

    // Auto-calculate Invoice Totals when line items change
    useEffect(() => {
        const newTotalAmount = editedInvoice.lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
        const newTotalTax = editedInvoice.lineItems.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
        const newTotalBeforeTax = editedInvoice.lineItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);

        // Only update if difference is significant (> 0.01) to avoid infinite loops/rounding jitter
        const hasChanges = 
            Math.abs(newTotalAmount - editedInvoice.totalAmount) > 0.01 ||
            Math.abs((newTotalTax - (editedInvoice.totalTax || 0))) > 0.01 ||
            Math.abs((newTotalBeforeTax - (editedInvoice.totalBeforeTax || 0))) > 0.01;

        if (hasChanges) {
            setEditedInvoice(prev => ({ 
                ...prev, 
                totalAmount: parseFloat(newTotalAmount.toFixed(2)),
                totalTax: parseFloat(newTotalTax.toFixed(2)),
                totalBeforeTax: parseFloat(newTotalBeforeTax.toFixed(2))
            }));
        }
    }, [editedInvoice.lineItems]);

    const handleChange = (field: keyof Invoice, value: any) => {
        setEditedInvoice(prev => ({ ...prev, [field]: value }));
    };

    const handleLineItemChange = (itemIndex: number, field: keyof LineItem, value: any) => {
        setEditedInvoice(prev => {
            const newItems = [...prev.lineItems];
            let currentItem = { ...newItems[itemIndex], [field]: value };
            
            // Logic for auto-calculation
            // Trigger recalculation if Quantity, Unit Price, or Tax Rate changes.
            if (field === 'quantity' || field === 'unitPrice' || field === 'taxRate') {
                const qty = field === 'quantity' ? (typeof value === 'number' ? value : 0) : currentItem.quantity;
                const price = field === 'unitPrice' ? (typeof value === 'number' ? value : 0) : currentItem.unitPrice;
                const rate = field === 'taxRate' ? (typeof value === 'number' ? value : 0) : (currentItem.taxRate || 0);

                // Calculate Subtotal
                const subtotal = parseFloat((qty * price).toFixed(2));
                
                // Calculate Tax Amount based on Rate
                const taxAmt = parseFloat((subtotal * (rate / 100)).toFixed(2));
                
                // Calculate Total
                const total = parseFloat((subtotal + taxAmt).toFixed(2));

                currentItem = {
                    ...currentItem,
                    quantity: qty,
                    unitPrice: price,
                    taxRate: rate,
                    subtotal: subtotal,
                    taxAmount: taxAmt,
                    total: total
                };
            } 
            // If User manually updates Tax Amount, recalculate Total but keep Subtotal
            else if (field === 'taxAmount') {
                 const taxAmt = typeof value === 'number' ? value : 0;
                 const subtotal = currentItem.subtotal || 0;
                 currentItem.total = parseFloat((subtotal + taxAmt).toFixed(2));
            }

            newItems[itemIndex] = currentItem;
            return { ...prev, lineItems: newItems };
        });
    };

    const handleDeleteLineItem = (itemIndex: number) => {
        setEditedInvoice(prev => ({ 
            ...prev, 
            lineItems: prev.lineItems.filter((_, i) => i !== itemIndex) 
        }));
    };

    const handleAddLineItem = () => {
        const newItem: LineItem = { description: '', quantity: 1, unitPrice: 0, total: 0, subtotal: 0, taxAmount: 0, taxRate: 0 };
        setEditedInvoice(prev => ({ ...prev, lineItems: [...prev.lineItems, newItem] }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(editedInvoice);
    };

    // Helper to safely handle number inputs
    const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>, callback: (val: number) => void) => {
        const val = e.target.value;
        if (val === '') {
            callback(0); // Treat empty input as 0 to keep internal state valid number
        } else {
            callback(parseFloat(val));
        }
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-muted rounded-xl border border-border shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted rounded-t-xl">
                    <h3 className="text-lg font-semibold text-foreground flex items-center">
                        <PencilIcon className="w-5 h-5 mr-2 text-blue-400"/> Edit Invoice
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-muted p-4 rounded-lg border border-border">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1 uppercase font-semibold">Invoice ID</label>
                                <input type="text" value={editedInvoice.invoiceId} onChange={e => handleChange('invoiceId', e.target.value)} className="w-full bg-muted border border-border rounded p-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1 uppercase font-semibold">Type</label>
                                <select value={editedInvoice.invoiceType} onChange={e => handleChange('invoiceType', e.target.value)} className="w-full bg-muted border border-border rounded p-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                                    <option value="sales">Sales</option>
                                    <option value="purchase">Purchase</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1 uppercase font-semibold">{editedInvoice.invoiceType === 'sales' ? 'Customer' : 'Vendor'}</label>
                                <input type="text" value={editedInvoice.invoiceType === 'sales' ? editedInvoice.customerName : editedInvoice.vendorName} onChange={e => handleChange(editedInvoice.invoiceType === 'sales' ? 'customerName' : 'vendorName', e.target.value)} className="w-full bg-muted border border-border rounded p-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1 uppercase font-semibold">Date</label>
                                <input type="text" value={editedInvoice.invoiceDate} onChange={e => handleChange('invoiceDate', e.target.value)} className="w-full bg-muted border border-border rounded p-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500 focus:border-blue-500" placeholder="YYYY-MM-DD"/>
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1 uppercase font-semibold">Due Date</label>
                                <input type="text" value={editedInvoice.dueDate} onChange={e => handleChange('dueDate', e.target.value)} className="w-full bg-muted border border-border rounded p-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500 focus:border-blue-500" placeholder="YYYY-MM-DD"/>
                            </div>
                            <div className="md:col-span-3 grid grid-cols-3 gap-4 pt-2 border-t border-border mt-2">
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1 uppercase font-semibold">Total Before Tax</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        value={editedInvoice.totalBeforeTax} 
                                        onChange={e => handleNumberInput(e, val => handleChange('totalBeforeTax', val))} 
                                        className="w-full bg-muted border border-border rounded p-2 text-sm text-foreground font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1 uppercase font-semibold">Total Tax</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        value={editedInvoice.totalTax} 
                                        onChange={e => handleNumberInput(e, val => handleChange('totalTax', val))} 
                                        className="w-full bg-muted border border-border rounded p-2 text-sm text-foreground font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1 uppercase font-semibold">Total Amount ({editedInvoice.currency})</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        value={editedInvoice.totalAmount} 
                                        onChange={e => handleNumberInput(e, val => handleChange('totalAmount', val))} 
                                        className="w-full bg-muted border border-border rounded p-2 text-sm text-foreground font-bold font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-semibold text-muted-foreground">Line Items</h4>
                            <button type="button" onClick={handleAddLineItem} className="flex items-center text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors bg-blue-900/20 px-3 py-1.5 rounded-md">
                                <PlusIcon className="w-3 h-3 mr-1"/> Add Item
                            </button>
                        </div>
                        
                        <div className="overflow-x-auto border border-border rounded-lg">
                            <table className="w-full text-sm text-left text-muted-foreground">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted">
                                    <tr>
                                        <th className="py-3 px-4">Description</th>
                                        <th className="py-3 px-4 w-20 text-right">Qty</th>
                                        <th className="py-3 px-4 w-28 text-right">Price</th>
                                        <th className="py-3 px-4 w-20 text-right">Tax %</th>
                                        <th className="py-3 px-4 w-28 text-right">Tax Amt</th>
                                        <th className="py-3 px-4 w-32 text-right">Total</th>
                                        <th className="py-3 px-4 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {editedInvoice.lineItems.map((item, i) => (
                                        <tr key={i} className="border-b border-border hover:bg-muted transition-colors">
                                            <td className="p-2 pl-4">
                                                <input 
                                                    type="text" 
                                                    value={item.description} 
                                                    onChange={e => handleLineItemChange(i, 'description', e.target.value)} 
                                                    className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:ring-0 p-1 text-foreground placeholder:text-muted-foreground transition-all" 
                                                    placeholder="Item description" 
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input 
                                                    type="number" 
                                                    value={item.quantity} 
                                                    onChange={e => handleNumberInput(e, val => handleLineItemChange(i, 'quantity', val))} 
                                                    className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:ring-0 p-1 text-right text-foreground font-mono" 
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={item.unitPrice} 
                                                    onChange={e => handleNumberInput(e, val => handleLineItemChange(i, 'unitPrice', val))} 
                                                    className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:ring-0 p-1 text-right text-foreground font-mono" 
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={item.taxRate ?? 0} 
                                                    onChange={e => handleNumberInput(e, val => handleLineItemChange(i, 'taxRate', val))} 
                                                    className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:ring-0 p-1 text-right text-foreground font-mono" 
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={item.taxAmount} 
                                                    onChange={e => handleNumberInput(e, val => handleLineItemChange(i, 'taxAmount', val))} 
                                                    className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:ring-0 p-1 text-right text-foreground font-mono" 
                                                />
                                            </td>
                                            <td className="p-2 pr-4">
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={item.total} 
                                                    onChange={e => handleNumberInput(e, val => handleLineItemChange(i, 'total', val))} 
                                                    className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:ring-0 p-1 text-right text-foreground font-mono font-bold" 
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                <button type="button" onClick={() => handleDeleteLineItem(i)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                                                    <TrashIcon className="w-4 h-4"/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {editedInvoice.lineItems.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center py-4 text-muted-foreground italic">No line items.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="p-4 border-t border-border bg-muted flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 bg-transparent border border-border text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm">Cancel</button>
                        <button type="submit" className="px-5 py-2.5 bg-blue-600 text-foreground font-semibold rounded-lg hover:bg-blue-500 transition-colors text-sm shadow-lg shadow-blue-900/20">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

