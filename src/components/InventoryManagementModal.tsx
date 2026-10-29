import React, { useState } from 'react';
import { Package, AlertTriangle, Plus, Search, X } from 'lucide-react';
import type { InventoryItem } from '../data/seedData';

interface InventoryManagementModalProps {
  isOpen: boolean;
  inventory: InventoryItem[];
  onClose: () => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onAddItem: (item: Omit<InventoryItem, 'id'>) => void;
}

export const InventoryManagementModal: React.FC<InventoryManagementModalProps> = ({
  isOpen,
  inventory,
  onClose,
  onUpdateQuantity,
  onAddItem
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    sku: '',
    name: '',
    category: 'hardware' as InventoryItem['category'],
    quantity_in_stock: 10,
    min_stock_alert: 5,
    unit_price: 100,
    unit: 'un' as InventoryItem['unit']
  });

  if (!isOpen) return null;

  const filtered = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockItems = inventory.filter((item) => item.quantity_in_stock <= item.min_stock_alert);
  const totalValueInStock = inventory.reduce(
    (acc, item) => acc + item.quantity_in_stock * item.unit_price,
    0
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim() || !newItem.sku.trim()) return;
    onAddItem(newItem);
    setShowAddForm(false);
    setNewItem({
      sku: '',
      name: '',
      category: 'hardware',
      quantity_in_stock: 10,
      min_stock_alert: 5,
      unit_price: 100,
      unit: 'un'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl">
              <Package size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Almoxarifado Central & Gestão de Peças (WMS)</h3>
              <p className="text-[11px] text-slate-400">Controle de saldo, ponto de pedido e baixa por OS</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Resumo de Estoque */}
        <div className="p-5 border-b bg-slate-50 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase">Total de Itens</span>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">{inventory.length} SKUs</div>
          </div>

          <div className="p-3 bg-white border border-amber-200 rounded-xl shadow-xs">
            <span className="text-[10.5px] font-bold text-amber-600 uppercase flex items-center gap-1">
              <AlertTriangle size={12} /> Estoque Baixo (Ponto de Pedido)
            </span>
            <div className="text-xl font-extrabold text-amber-600 mt-0.5">
              {lowStockItems.length} {lowStockItems.length === 1 ? 'item' : 'itens'}
            </div>
          </div>

          <div className="p-3 bg-white border border-blue-200 rounded-xl shadow-xs">
            <span className="text-[10.5px] font-bold text-blue-600 uppercase">Valor em Estoque</span>
            <div className="text-xl font-extrabold text-blue-700 mt-0.5">
              R$ {totalValueInStock.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Barra de Busca e Ação */}
        <div className="px-5 py-3 border-b flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por descrição da peça ou código SKU..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
          >
            <Plus size={14} /> Novo Item de Peça
          </button>
        </div>

        {/* Formulário Novo Item */}
        {showAddForm && (
          <form onSubmit={handleCreate} className="p-4 bg-blue-50/60 border-b space-y-3 animate-fadeIn">
            <div className="font-bold text-xs text-blue-900">Cadastrar Novo Item no Almoxarifado</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block">SKU *</label>
                <input
                  type="text"
                  required
                  value={newItem.sku}
                  onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                  placeholder="Ex: RED-CAT6-EXT"
                  className="w-full text-xs p-1.5 border rounded-lg bg-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-600 block">Descrição da Peça *</label>
                <input
                  type="text"
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="Ex: Patch Cord CAT6 2.5m Azul"
                  className="w-full text-xs p-1.5 border rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block">Categoria</label>
                <select
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value as any })}
                  className="w-full text-xs p-1.5 border rounded-lg bg-white"
                >
                  <option value="hardware">Hardware</option>
                  <option value="rede">Rede</option>
                  <option value="periferico">Periférico</option>
                  <option value="impressao">Impressão</option>
                  <option value="eletrica">Elétrica</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block">Qtd Inicial</label>
                <input
                  type="number"
                  min={0}
                  value={newItem.quantity_in_stock}
                  onChange={(e) => setNewItem({ ...newItem, quantity_in_stock: parseInt(e.target.value) || 0 })}
                  className="w-full text-xs p-1.5 border rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block">Estoque Mínimo</label>
                <input
                  type="number"
                  min={1}
                  value={newItem.min_stock_alert}
                  onChange={(e) => setNewItem({ ...newItem, min_stock_alert: parseInt(e.target.value) || 1 })}
                  className="w-full text-xs p-1.5 border rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block">Preço Unitário (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={newItem.unit_price}
                  onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs p-1.5 border rounded-lg bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg"
              >
                Salvar Item
              </button>
            </div>
          </form>
        )}

        {/* Tabela de Itens */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b sticky top-0">
              <tr>
                <th className="p-3">SKU</th>
                <th className="p-3">Peça / Componente</th>
                <th className="p-3">Categoria</th>
                <th className="p-3 text-center">Saldo</th>
                <th className="p-3 text-right">Preço Unit.</th>
                <th className="p-3 text-center">Ajuste Rápido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const isLow = item.quantity_in_stock <= item.min_stock_alert;
                return (
                  <tr key={item.id} className={isLow ? 'bg-amber-50/50' : 'hover:bg-slate-50'}>
                    <td className="p-3 font-mono text-[11px] font-bold text-slate-700">{item.sku}</td>
                    <td className="p-3 font-medium text-slate-900">
                      {item.name}
                      {isLow && (
                        <span className="ml-2 text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                          <AlertTriangle size={10} /> Abaixo do mínimo ({item.min_stock_alert})
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="capitalize text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold text-sm">
                      <span className={isLow ? 'text-amber-600' : 'text-slate-800'}>
                        {item.quantity_in_stock} {item.unit}
                      </span>
                    </td>
                    <td className="p-3 text-right text-slate-700 font-mono">
                      R$ {item.unit_price.toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-white">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          disabled={item.quantity_in_stock <= 0}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-40 text-rose-600 font-bold"
                          title="Dar baixa em 1 unidade"
                        >
                          -
                        </button>
                        <span className="px-1 text-[11px] font-mono">{item.quantity_in_stock}</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-emerald-600 font-bold"
                          title="Dar entrada em 1 unidade"
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
