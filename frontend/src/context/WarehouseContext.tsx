import React, { createContext, useContext, useState, useEffect } from 'react';
import { Warehouse } from '../types/index.js';
import { api } from '../services/api.js';

interface WarehouseContextType {
  warehouses: Warehouse[];
  selectedWarehouse: Warehouse | null;
  selectedWarehouseId: string | undefined;
  setSelectedWarehouseId: (id: string | undefined) => void;
  isLoading: boolean;
  refreshWarehouses: () => Promise<void>;
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

export const WarehouseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseIdState] = useState<string | undefined>(
    localStorage.getItem('stockpilot_warehouse_id') || undefined
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchWarehouses = async () => {
    try {
      const data = await api.listWarehouses();
      setWarehouses(data);
      if (!selectedWarehouseId && data.length > 0) {
        const defaultWh = data.find((w) => w.isDefault) || data[0];
        setSelectedWarehouseIdState(defaultWh.id);
        localStorage.setItem('stockpilot_warehouse_id', defaultWh.id);
      }
    } catch (err) {
      console.error('Failed to load warehouses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('stockpilot_token');
    if (token) {
      fetchWarehouses();
    } else {
      setIsLoading(false);
    }
  }, []);

  const setSelectedWarehouseId = (id: string | undefined) => {
    setSelectedWarehouseIdState(id);
    if (id) {
      localStorage.setItem('stockpilot_warehouse_id', id);
    } else {
      localStorage.removeItem('stockpilot_warehouse_id');
    }
  };

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId) || null;

  return (
    <WarehouseContext.Provider
      value={{
        warehouses,
        selectedWarehouse,
        selectedWarehouseId,
        setSelectedWarehouseId,
        isLoading,
        refreshWarehouses: fetchWarehouses,
      }}
    >
      {children}
    </WarehouseContext.Provider>
  );
};

export const useWarehouse = () => {
  const context = useContext(WarehouseContext);
  if (!context) {
    throw new Error('useWarehouse must be used within a WarehouseProvider');
  }
  return context;
};
