import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, ShoppingCart, Truck, MapPin, X } from 'lucide-react';
import { api } from '../../services/api.js';

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchDialog: React.FC<GlobalSearchDialogProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    products: any[];
    orders: any[];
    purchaseOrders: any[];
  }>({ products: [], orders: [], purchaseOrders: [] });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults({ products: [], orders: [], purchaseOrders: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const [products, orders, purchaseOrders] = await Promise.all([
          api.listProducts({ search: query, limit: 5 }),
          api.listSalesOrders({ search: query, limit: 5 }),
          api.listPurchaseOrders({ search: query, limit: 5 }),
        ]);
        setResults({ products, orders, purchaseOrders });
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div className="fixed inset-0 bg-surface-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-lg border border-surface-200 shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
        {/* Search header */}
        <div className="flex items-center px-4 py-3 border-b border-surface-200">
          <Search className="w-5 h-5 text-surface-400 shrink-0 mr-3" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search SKUs, Orders, Purchase Orders, or Facilities..."
            className="w-full text-sm outline-none bg-transparent placeholder:text-surface-400 text-surface-900"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 text-surface-400 hover:text-surface-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="overflow-y-auto p-2 text-xs">
          {isLoading && <div className="p-4 text-center text-surface-400">Searching inventory database...</div>}

          {!isLoading && query.length >= 2 && results.products.length === 0 && results.orders.length === 0 && results.purchaseOrders.length === 0 && (
            <div className="p-6 text-center text-surface-500">No matching warehouse entities found.</div>
          )}

          {/* Products */}
          {results.products.length > 0 && (
            <div className="mb-3">
              <div className="px-3 py-1.5 font-semibold text-surface-400 uppercase tracking-wider text-[10px]">
                Products & SKUs
              </div>
              {results.products.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    navigate(`/inventory?sku=${p.sku}`);
                    onClose();
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-surface-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Package className="w-4 h-4 text-brand-500" />
                    <div>
                      <span className="font-mono font-medium text-surface-900">{p.sku}</span>
                      <span className="text-surface-500 ml-2">{p.name}</span>
                    </div>
                  </div>
                  <span className="font-mono text-surface-500">${p.unitCost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Sales Orders */}
          {results.orders.length > 0 && (
            <div className="mb-3">
              <div className="px-3 py-1.5 font-semibold text-surface-400 uppercase tracking-wider text-[10px]">
                Customer Orders
              </div>
              {results.orders.map((o) => (
                <div
                  key={o.id}
                  onClick={() => {
                    navigate(`/sales-orders?order=${o.orderNumber}`);
                    onClose();
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-surface-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <ShoppingCart className="w-4 h-4 text-sky-500" />
                    <div>
                      <span className="font-mono font-medium text-surface-900">{o.orderNumber}</span>
                      <span className="text-surface-500 ml-2">{o.customer?.name}</span>
                    </div>
                  </div>
                  <span className="font-mono uppercase text-[10px] px-1.5 py-0.5 rounded bg-surface-100 border border-surface-200">
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Purchase Orders */}
          {results.purchaseOrders.length > 0 && (
            <div>
              <div className="px-3 py-1.5 font-semibold text-surface-400 uppercase tracking-wider text-[10px]">
                Inbound Purchase Orders
              </div>
              {results.purchaseOrders.map((po) => (
                <div
                  key={po.id}
                  onClick={() => {
                    navigate(`/purchase-orders?po=${po.poNumber}`);
                    onClose();
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-surface-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Truck className="w-4 h-4 text-amber-500" />
                    <div>
                      <span className="font-mono font-medium text-surface-900">{po.poNumber}</span>
                      <span className="text-surface-500 ml-2">{po.supplier?.name}</span>
                    </div>
                  </div>
                  <span className="font-mono uppercase text-[10px] px-1.5 py-0.5 rounded bg-surface-100 border border-surface-200">
                    {po.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-surface-50 border-t border-surface-200 flex items-center justify-between text-[11px] text-surface-400">
          <span>Navigation: Click an item to jump directly to its view</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
